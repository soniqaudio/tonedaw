import { Midi } from "@tonejs/midi";
import { deriveFromEvents as deriveFromEventsCore } from "@/core/midi/derive";
import type { MidiDomainEvent } from "@/core/midi/types";
import type { MidiState } from "../types";
import { usePatternStore } from "@/core/stores/usePatternStore";
import { getActiveTrackId } from "@/core/utils/trackUtils";
import { useMusicTheoryStore } from "@/core/stores/useMusicTheoryStore";

interface ImportOptions {
  mode?: "replace" | "append";
  targetPatternId?: string;
  targetTrackId?: string;
}

export const createFileActions = (
  get: () => MidiState,
  set: (partial: Partial<MidiState> | ((state: MidiState) => Partial<MidiState>)) => void,
  clearRecordingState: () => void,
) => ({
  loadFromArrayBuffer: async (buffer: ArrayBuffer, options: ImportOptions = {}) => {
    const { mode = "append", targetPatternId, targetTrackId } = options;

    clearRecordingState();
    set({ status: "loading" as const, error: undefined });

    try {
      const midi = new Midi(buffer);
      const events: MidiDomainEvent[] = [];

      // Get target pattern and track
      const patternId = targetPatternId ?? usePatternStore.getState().editingPatternId;
      const trackId = targetTrackId ?? getActiveTrackId();

      midi.tracks.forEach((track) => {
        track.notes.forEach((note) => {
          const noteId = `clip-${note.midi}-${note.time}-${Math.random().toString(16).slice(2)}`;
          const startMs = note.time * 1000;
          const endMs = (note.time + note.duration) * 1000;
          // Convert velocity from @tonejs/midi's 0-1 range to our 0-127 range
          const velocity = Math.round(note.velocity * 127);

          events.push({
            id: `evt-${noteId}-on`,
            type: "noteOn",
            timestamp: startMs,
            noteNumber: note.midi,
            velocity,
            channel: track.channel ?? 0,
            noteId,
            trackId,
            patternId,
          });

          events.push({
            id: `evt-${noteId}-off`,
            type: "noteOff",
            timestamp: endMs,
            noteNumber: note.midi,
            velocity,
            channel: track.channel ?? 0,
            noteId,
            trackId,
            patternId,
          });
        });

        Object.entries(track.controlChanges ?? {}).forEach(([controller, changes]) => {
          changes.forEach((change) => {
            events.push({
              id: `evt-cc-${controller}-${change.time}-${Math.random().toString(16).slice(2)}`,
              type: "cc",
              timestamp: change.time * 1000,
              controller: Number.parseInt(controller, 10),
              value: Math.round((change.value ?? 0) * 127),
              channel: track.channel ?? 0,
            });
          });
        });
      });

      // Merge or replace based on mode
      const state = get();
      const finalEvents = mode === "append" ? [...state.events, ...events] : events;
      const derived = deriveFromEventsCore(finalEvents);

      set({
        midi,
        clips: derived.clips,
        events: finalEvents,
        clipsWithoutSustain: derived.clipsWithoutSustain,
        controlEvents: derived.controlEvents,
        status: "ready" as const,
      });
    } catch (error) {
      set({
        midi: null,
        status: "error" as const,
        error: error instanceof Error ? error.message : "Failed to parse MIDI",
      });
    }
  },

  exportToMidi: (patternId?: string) => {
    const state = get();
    const targetPatternId = patternId ?? usePatternStore.getState().editingPatternId;
    const pattern = usePatternStore.getState().patterns.find((p) => p.id === targetPatternId);

    if (!targetPatternId) {
      console.warn("No pattern selected for export");
      return;
    }

    // Filter events by pattern - if event has no patternId, include it (backward compatibility)
    const patternEvents = state.events.filter((event) => {
      if (event.type === "cc") return true; // Include all control events
      return !event.patternId || event.patternId === targetPatternId;
    });

    if (patternEvents.length === 0) {
      console.warn("No events to export");
      return;
    }

    // Create MIDI file
    const midi = new Midi();
    const track = midi.addTrack();

    // Set tempo from project
    const tempo = useMusicTheoryStore.getState().tempo;
    midi.header.setTempo(tempo);

    // Group noteOn/noteOff events into note objects
    const noteMap = new Map<
      string,
      { noteNumber: number; velocity: number; startTime: number; channel: number }
    >();

    patternEvents.forEach((event) => {
      if (event.type === "noteOn") {
        noteMap.set(event.noteId, {
          noteNumber: event.noteNumber,
          velocity: event.velocity,
          startTime: event.timestamp / 1000, // Convert to seconds
          channel: event.channel,
        });
      } else if (event.type === "noteOff") {
        const noteInfo = noteMap.get(event.noteId);
        if (noteInfo) {
          const endTime = event.timestamp / 1000;
          const duration = endTime - noteInfo.startTime;

          track.addNote({
            midi: noteInfo.noteNumber,
            time: noteInfo.startTime,
            duration: Math.max(0.001, duration),
            velocity: noteInfo.velocity / 127, // Convert from our 0-127 range to @tonejs/midi's 0-1 range
          });

          noteMap.delete(event.noteId);
        }
      } else if (event.type === "cc") {
        // Add control changes (e.g., sustain pedal)
        track.addCC({
          number: event.controller,
          value: event.value / 127, // Normalize to 0-1
          time: event.timestamp / 1000,
        });
      }
    });

    // Convert to array buffer and download
    const arrayBuffer = midi.toArray();
    const blob = new Blob([arrayBuffer], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pattern?.name ?? "pattern"}.mid`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  reset: () => {
    clearRecordingState();
    set({
      midi: null,
      status: "idle" as const,
      error: undefined,
      devices: [],
      selectedInputId: undefined,
      clips: [],
      events: [],
      clipsWithoutSustain: [],
      controlEvents: [],
      liveEvents: [],
      isRecording: false,
      computerInputEnabled: true,
      recordArm: false,
      midiAccessState: "initial",
      midiAccessError: undefined,
      midiAccessRequestToken: 0,
      recordingPreviewClips: [],
      recordingPreviewMeta: {},
    });
  },
});
