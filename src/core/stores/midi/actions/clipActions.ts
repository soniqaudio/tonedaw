import type { MidiNoteClip } from "@/core/midi/types";
import { midiNumberToName } from "@/core/midi/utils";
import { generateClipId } from "@/core/utils/id";
import type { MidiState } from "../types";
import { deriveFromEvents, noteEventsFromClip } from "./sharedHelpers";

export const createClipActions = (
  get: () => MidiState,
  set: (partial: Partial<MidiState> | ((state: MidiState) => Partial<MidiState>)) => void,
) => ({
  addClip: (clip: MidiNoteClip) => {
    const state = get();
    const events = [...state.events, ...noteEventsFromClip(clip)];
    const derived = deriveFromEvents(events, undefined, [...state.clips, clip]);

    set({
      events,
      ...derived,
    });
  },

  removeClip: (clipId: string) => {
    const state = get();
    const events = state.events.filter((event) =>
      event.type === "cc" ? true : event.noteId !== clipId,
    );

    const derived = deriveFromEvents(events, undefined, state.clips);

    set({
      events,
      ...derived,
      selectedClipIds: state.selectedClipIds.filter((id) => id !== clipId),
    });
  },

  updateClipDuration: (clipId: string, newDuration: number) => {
    const state = get();
    const clip = state.clips.find((c) => c.id === clipId);
    if (!clip) return;

    const updatedEvents = state.events.map((event) => {
      if (event.type === "noteOff" && event.noteId === clipId) {
        return {
          ...event,
          timestamp: clip.start + newDuration,
        };
      }
      return event;
    });

    const derived = deriveFromEvents(updatedEvents, undefined, state.clips);

    set({
      events: updatedEvents,
      ...derived,
    });
  },

  updateClips: (
    updates: Array<{
      id: string;
      start: number;
      noteNumber: number;
    }>,
  ) => {
    const state = get();
    const updateMap = new Map(
      updates.map((update) => [update.id, { ...update, start: Math.max(0, update.start) }]),
    );

    const updatedClips = state.clips.map((clip) => {
      const update = updateMap.get(clip.id);
      if (!update) return clip;

      const boundedNoteNumber = Math.max(0, Math.min(127, update.noteNumber));
      return {
        ...clip,
        start: update.start,
        noteNumber: boundedNoteNumber,
        noteName: midiNumberToName(boundedNoteNumber),
        // Preserve patternId
        patternId: clip.patternId,
      };
    });

    const updatedClipMap = new Map(updatedClips.map((clip) => [clip.id, clip]));

    const updatedEvents = state.events.map((event) => {
      if (event.type === "cc") return event;
      const clip = updatedClipMap.get(event.noteId);
      if (!clip) return event;

      if (event.type === "noteOn") {
        return {
          ...event,
          timestamp: clip.start,
          noteNumber: clip.noteNumber,
        };
      }

      if (event.type === "noteOff") {
        return {
          ...event,
          timestamp: clip.start + clip.duration,
          noteNumber: clip.noteNumber,
        };
      }

      return event;
    });

    const derived = deriveFromEvents(updatedEvents, undefined, updatedClips);

    set({
      events: updatedEvents,
      clips: derived.clips,
      clipsWithoutSustain: derived.clipsWithoutSustain,
      controlEvents: derived.controlEvents,
    });
  },

  updateClipVelocity: (clipIds: string[], velocity: number) => {
    if (clipIds.length === 0) return;
    const state = get();
    // Clamp velocity to MIDI range (0-127)
    const clampedVelocity = Math.max(0, Math.min(127, Math.round(velocity)));
    const idSet = new Set(clipIds);

    const updatedClips = state.clips.map((clip) => {
      if (!idSet.has(clip.id)) return clip;
      return {
        ...clip,
        velocity: clampedVelocity,
      };
    });

    const updatedEvents = state.events.map((event) => {
      if (event.type === "cc" || !idSet.has(event.noteId)) {
        return event;
      }
      return {
        ...event,
        velocity: clampedVelocity,
      };
    });

    const derived = deriveFromEvents(updatedEvents, undefined, updatedClips);

    set({
      events: updatedEvents,
      clips: derived.clips,
      clipsWithoutSustain: derived.clipsWithoutSustain,
      controlEvents: derived.controlEvents,
    });
  },

  setSelectedClipIds: (ids: string[]) => set({ selectedClipIds: ids }),

  splitClipAt: (clipId: string, cutMs: number) => {
    const state = get();
    const clip = state.clips.find((c) => c.id === clipId);
    if (!clip) return;

    // Validate cut position is within clip bounds
    const clipStart = clip.start;
    const clipEnd = clip.start + clip.duration;
    if (cutMs <= clipStart || cutMs >= clipEnd) return;

    // Calculate durations for the two resulting clips
    const firstDuration = cutMs - clipStart;
    const secondDuration = clipEnd - cutMs;

    // Create first clip (original, shortened)
    const firstClip: MidiNoteClip = {
      ...clip,
      duration: firstDuration,
    };

    // Create second clip (new, starts at cut position)
    const secondClip: MidiNoteClip = {
      id: generateClipId(clip.noteNumber, cutMs),
      noteNumber: clip.noteNumber,
      noteName: clip.noteName,
      channel: clip.channel,
      velocity: clip.velocity,
      start: cutMs,
      duration: secondDuration,
      trackId: clip.trackId,
      patternId: clip.patternId, // Preserve patternId
    };

    // Remove old events for this clip
    const filteredEvents = state.events.filter(
      (event) => event.type === "cc" || event.noteId !== clipId,
    );

    // Add events for both new clips
    const newEvents = [
      ...filteredEvents,
      ...noteEventsFromClip(firstClip),
      ...noteEventsFromClip(secondClip),
    ];

    // Update clips array: replace old clip with two new clips
    const updatedClips = state.clips
      .filter((c) => c.id !== clipId)
      .concat([firstClip, secondClip]);

    const derived = deriveFromEvents(newEvents, undefined, updatedClips);

    // Update selection to include both new clips
    const newSelectedIds = state.selectedClipIds.includes(clipId)
      ? [...state.selectedClipIds.filter((id) => id !== clipId), firstClip.id, secondClip.id]
      : state.selectedClipIds;

    set({
      events: newEvents,
      ...derived,
      selectedClipIds: newSelectedIds,
    });
  },
});
