import type { MidiNoteClip } from "@/core/midi/types";
import { midiNumberToName } from "@/core/midi/utils";
import { generateClipId } from "@/core/utils/id";
import { getActiveTrackId } from "@/core/utils/trackUtils";
import { getOrCreateEditingPattern, updatePatternClipLengths } from "@/core/utils/patternUtils";
import { useClipboardStore } from "../../useClipboardStore";
import type { MidiState } from "../types";
import { deriveFromEvents, noteEventsFromClip } from "./sharedHelpers";

interface ClipboardItem {
  offset: number;
  duration: number;
  noteNumber: number;
  velocity: number | undefined;
  trackId: string;
  channel: number;
}

interface MidiClipboard {
  items: ClipboardItem[];
  baseNoteNumber: number;
}

const clampMidi = (value: number) => Math.max(0, Math.min(127, value));

const buildClipboard = (clips: MidiNoteClip[]): MidiClipboard | null => {
  if (clips.length === 0) {
    return null;
  }

  const minStart = clips.reduce(
    (min, clip) => (clip.start < min ? clip.start : min),
    clips[0].start,
  );

  const firstClip = clips.reduce(
    (earliest, clip) => (clip.start < earliest.start ? clip : earliest),
    clips[0],
  );

  const items = clips.map<ClipboardItem>((clip) => ({
    offset: clip.start - minStart,
    duration: clip.duration,
    noteNumber: clip.noteNumber,
    velocity: clip.velocity,
    trackId: clip.trackId,
    channel: clip.channel,
  }));

  return {
    items,
    baseNoteNumber: firstClip.noteNumber,
  };
};

export const createClipboardActions = (
  get: () => MidiState,
  set: (partial: Partial<MidiState> | ((state: MidiState) => Partial<MidiState>)) => void,
) => ({
  copySelectedClips: () =>
    set((state) => {
      if (state.selectedClipIds.length === 0) {
        return state;
      }

      const selectedSet = new Set(state.selectedClipIds);
      const selectedClips = state.clips.filter((clip) => selectedSet.has(clip.id));
      const clipboard = buildClipboard(selectedClips);

      if (!clipboard) {
        return state;
      }

      // Store in global clipboard
      useClipboardStore.getState().actions.setClipboard(clipboard);

      return state;
    }),

  cutSelectedClips: () => {
    const state = get();
    if (state.selectedClipIds.length === 0) {
      return;
    }

    const selectedSet = new Set(state.selectedClipIds);
    const selectedClips = state.clips.filter((clip) => selectedSet.has(clip.id));
    const clipboard = buildClipboard(selectedClips);

    if (!clipboard) {
      return;
    }

    // Store in global clipboard
    useClipboardStore.getState().actions.setClipboard(clipboard);

    // Collect pattern IDs to update
    const affectedPatternIds = new Set(
      selectedClips.map((clip) => clip.patternId).filter((id): id is string => id !== undefined)
    );

    const remainingEvents = state.events.filter((event) =>
      event.type === "cc" ? true : !selectedSet.has(event.noteId),
    );

    const derived = deriveFromEvents(remainingEvents, undefined, state.clips);

    set({
      events: remainingEvents,
      ...derived,
      selectedClipIds: [],
    });
    
    // Update pattern clip lengths for affected patterns
    // Use setTimeout to ensure clips have been removed from the store first
    setTimeout(() => {
      affectedPatternIds.forEach((patternId) => {
        updatePatternClipLengths(patternId);
      });
    }, 0);
  },

  pasteClipsAt: (targetMs: number, targetNoteNumber: number) => {
    const state = get();
    // Get from global clipboard
    const clipboard = useClipboardStore.getState().clipboard;
    if (!clipboard || clipboard.items.length === 0) {
      return;
    }

    const noteDelta = targetNoteNumber - clipboard.baseNoteNumber;
    const activeTrackId = getActiveTrackId();
    const patternId = getOrCreateEditingPattern(); // Get or create pattern for pasted notes

    const newClips = clipboard.items.map<MidiNoteClip>((item) => {
      const noteNumber = clampMidi(item.noteNumber + noteDelta);
      const noteName = midiNumberToName(noteNumber);
      const start = Math.max(0, targetMs + item.offset);
      return {
        id: generateClipId(noteNumber, start),
        noteNumber,
        noteName,
        channel: item.channel,
        velocity: item.velocity,
        start,
        duration: item.duration,
        trackId: activeTrackId, // Use current active track instead of original
        patternId, // Assign to current editing pattern
      };
    });

    if (newClips.length === 0) {
      return;
    }

    const events = [...state.events];
    newClips.forEach((clip) => {
      events.push(...noteEventsFromClip(clip));
    });

    const derived = deriveFromEvents(events, undefined, [...state.clips, ...newClips]);

    set({
      events,
      ...derived,
      selectedClipIds: newClips.map((clip) => clip.id),
    });
    
    // Update pattern clip length after pasting
    // Use setTimeout to ensure clips have been added to the store first
    setTimeout(() => {
      updatePatternClipLengths(patternId);
    }, 0);
  },
});
