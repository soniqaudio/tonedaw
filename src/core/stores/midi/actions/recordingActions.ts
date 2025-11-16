import {
  deriveFromEvents,
  deriveIncremental,
  type IncrementalDeriveState,
} from "@/core/midi/derive";
import type { MidiDomainEvent, MidiNoteClip } from "@/core/midi/types";
import { midiNumberToName } from "@/core/midi/utils";
import { getActiveTrackId } from "@/core/utils/trackUtils";
import type { MidiState } from "../types";

// Track-specific recording state for incremental derivation
const recordingStateByTrack = new Map<string, IncrementalDeriveState>();

export const createRecordingActions = (
  get: () => MidiState,
  set: (partial: Partial<MidiState> | ((state: MidiState) => Partial<MidiState>)) => void,
) => ({
  setRecording: (value: boolean) => {
    if (value) {
      recordingStateByTrack.clear();
      set({ isRecording: true, recordingPreviewClips: [], recordingPreviewMeta: {} });
      return;
    }

    recordingStateByTrack.clear();

    const state = get();
    const derived = deriveFromEvents(state.events, undefined, state.clips);

    set({
      isRecording: false,
      clips: derived.clips,
      clipsWithoutSustain: derived.clipsWithoutSustain,
      controlEvents: derived.controlEvents,
      recordingPreviewClips: [],
      recordingPreviewMeta: {},
    });
  },

  setRecordArm: (value: boolean) => set({ recordArm: value }),

  setComputerInputEnabled: (value: boolean) => set({ computerInputEnabled: value }),

  appendEvents: (newEvents: MidiDomainEvent[], trackId: string) => {
    if (newEvents.length === 0) {
      return;
    }

    const state = get();
    const targetTrackId = trackId ?? getActiveTrackId();

    if (state.isRecording) {
      const incremental = deriveIncremental(
        newEvents,
        targetTrackId,
        recordingStateByTrack.get(targetTrackId),
      );
      recordingStateByTrack.set(targetTrackId, incremental.state);

      set((current) => {
        const updates: Partial<MidiState> = {
          events: [...current.events, ...newEvents],
        };

        if (incremental.newClips.length > 0) {
          updates.clips = [...current.clips, ...incremental.newClips];
        }

        if (incremental.newClipsWithoutSustain.length > 0) {
          updates.clipsWithoutSustain = [
            ...current.clipsWithoutSustain,
            ...incremental.newClipsWithoutSustain,
          ];
        }

        if (incremental.controlEvents.length > 0) {
          updates.controlEvents = [...current.controlEvents, ...incremental.controlEvents];
        }

        return updates;
      });
      return;
    }

    const mergedEvents = [...state.events, ...newEvents];
    const derived = deriveFromEvents(mergedEvents, targetTrackId, state.clips);

    set({
      events: mergedEvents,
      clips: derived.clips,
      clipsWithoutSustain: derived.clipsWithoutSustain,
      controlEvents: derived.controlEvents,
    });
  },

  // Recording preview management (for live note stretching)
  beginRecordingPreview: ({
    noteId,
    noteNumber,
    startMs,
    velocity,
    channel,
    trackId,
    patternId,
  }: {
    noteId: string;
    noteNumber: number;
    startMs: number;
    velocity: number;
    channel: number;
    trackId: string;
    patternId?: string;
  }) =>
    set((state) => {
      const noteName = midiNumberToName(noteNumber);
      const clip: MidiNoteClip & { isPreview: true } = {
        id: noteId,
        noteNumber,
        noteName,
        channel,
        velocity,
        start: startMs,
        duration: 1,
        trackId,
        patternId,
        isPreview: true,
      };

      const existingIndex = state.recordingPreviewClips.findIndex((c) => c.id === noteId);
      const nextClips =
        existingIndex === -1
          ? [...state.recordingPreviewClips, clip]
          : state.recordingPreviewClips.map((c, idx) => (idx === existingIndex ? clip : c));

      return {
        recordingPreviewClips: nextClips,
        recordingPreviewMeta: {
          ...state.recordingPreviewMeta,
          [noteId]: { startMs },
        },
      };
    }),

  updateRecordingPreviews: (currentMs: number) =>
    set((state) => {
      if (state.recordingPreviewClips.length === 0) {
        return state;
      }

      const nextClips = state.recordingPreviewClips.map((clip) => {
        const meta = state.recordingPreviewMeta[clip.id];
        if (!meta) {
          return clip;
        }
        const nextDuration = Math.max(1, Math.round(currentMs - meta.startMs));
        if (nextDuration === clip.duration) {
          return clip;
        }
        const updated: MidiNoteClip & { isPreview: true } = {
          ...clip,
          duration: nextDuration,
          isPreview: true,
        };
        return updated;
      });

      return {
        recordingPreviewClips: nextClips,
      };
    }),

  endRecordingPreview: (noteId: string) =>
    set((state) => {
      if (!state.recordingPreviewMeta[noteId]) {
        return state;
      }
      const { [noteId]: _removed, ...restMeta } = state.recordingPreviewMeta;
      return {
        recordingPreviewClips: state.recordingPreviewClips.filter((clip) => clip.id !== noteId),
        recordingPreviewMeta: restMeta,
      };
    }),

  clearRecordingPreviews: () => set({ recordingPreviewClips: [], recordingPreviewMeta: {} }),

  // Clear recording state (used during reset)
  clearRecordingState: () => {
    recordingStateByTrack.clear();
  },
});
