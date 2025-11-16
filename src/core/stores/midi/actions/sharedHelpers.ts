import { deriveFromEvents as deriveFromEventsCore } from "@/core/midi/derive";
import type { MidiControlChangeEvent, MidiDomainEvent, MidiNoteClip } from "@/core/midi/types";
import { generateId } from "@/core/utils/id";

export interface DerivedEventData {
  clips: MidiNoteClip[];
  clipsWithoutSustain: MidiNoteClip[];
  controlEvents: MidiControlChangeEvent[];
}

/**
 * Helper function to derive state from events and return standardized shape
 * This reduces code duplication across all action modules
 */
export const deriveFromEvents = (
  events: MidiDomainEvent[],
  trackId?: string,
  existingClips?: MidiNoteClip[],
): DerivedEventData => {
  const derived = deriveFromEventsCore(events, trackId, existingClips);
  return {
    clips: derived.clips,
    clipsWithoutSustain: derived.clipsWithoutSustain,
    controlEvents: derived.controlEvents,
  };
};

/**
 * Helper to create note on/off events from a clip
 */
export const noteEventsFromClip = (clip: MidiNoteClip): MidiDomainEvent[] => {
  const noteId = clip.id;
  const onId = `evt-${noteId}-on-${generateId()}`;
  const offId = `evt-${noteId}-off-${generateId()}`;
  return [
    {
      id: onId,
      type: "noteOn" as const,
      timestamp: clip.start,
      noteNumber: clip.noteNumber,
      velocity: clip.velocity ?? 0.8,
      channel: clip.channel,
      noteId,
      trackId: clip.trackId, // Preserve trackId
      patternId: clip.patternId, // Preserve patternId
    },
    {
      id: offId,
      type: "noteOff" as const,
      timestamp: clip.start + clip.duration,
      noteNumber: clip.noteNumber,
      velocity: clip.velocity ?? 0.8,
      channel: clip.channel,
      noteId,
      trackId: clip.trackId, // Preserve trackId
      patternId: clip.patternId, // Preserve patternId
    },
  ];
};
