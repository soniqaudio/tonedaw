import type { MidiControlChangeEvent, MidiDomainEvent, MidiNoteClip } from "@/core/midi/types";
import { midiNumberToName } from "@/core/midi/utils";
import { getActiveTrackId, resolveTrackId } from "@/core/utils/trackUtils";

interface ActiveNote {
  noteId: string;
  noteNumber: number;
  startMs: number;
  velocity: number;
  channel: number;
  trackId: string;
  patternId?: string; // Pattern this note belongs to
}

export interface DeriveResult {
  clips: MidiNoteClip[];
  clipsWithoutSustain: MidiNoteClip[];
  controlEvents: MidiControlChangeEvent[];
}

export interface IncrementalDeriveState {
  activeNotes: Map<string, ActiveNote[]>;
  pendingSustain: Map<number, ActiveNote[]>;
  sustainState: Map<number, boolean>;
}

export interface IncrementalDeriveResult {
  newClips: MidiNoteClip[];
  newClipsWithoutSustain: MidiNoteClip[];
  controlEvents: MidiControlChangeEvent[];
  state: IncrementalDeriveState;
}

const MIN_DURATION_MS = 1;
const TAIL_PADDING_MS = 200;

const makeClip = (note: ActiveNote, endMs: number): MidiNoteClip => ({
  id: note.noteId,
  noteNumber: note.noteNumber,
  noteName: midiNumberToName(note.noteNumber),
  channel: note.channel,
  velocity: note.velocity,
  start: note.startMs,
  duration: Math.max(MIN_DURATION_MS, endMs - note.startMs),
  trackId: resolveTrackId(note.trackId),
  patternId: note.patternId, // Preserve patternId
});

const mapKey = (channel: number, noteNumber: number) => `${channel}:${noteNumber}`;

export const deriveFromEvents = (
  events: MidiDomainEvent[],
  trackId?: string,
  existingClips?: MidiNoteClip[],
): DeriveResult => {
  if (events.length === 0) {
    return { clips: [], clipsWithoutSustain: [], controlEvents: [] };
  }

  const trackIdMap = new Map<string, string>();
  if (existingClips) {
    existingClips.forEach((clip) => {
      const resolvedId = resolveTrackId(clip.trackId);
      trackIdMap.set(clip.id, resolvedId);
    });
  }

  const finalTrackId = resolveTrackId(trackId ?? getActiveTrackId());

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const activeNotesById = new Map<string, ActiveNote>();
  const activeStacksByKey = new Map<string, ActiveNote[]>();
  const pendingSustain = new Map<number, ActiveNote[]>();
  const sustainState = new Map<number, boolean>();
  const controlEvents: MidiControlChangeEvent[] = [];

  const clips: MidiNoteClip[] = [];
  const clipsWithoutSustain: MidiNoteClip[] = [];
  let lastTimestamp = sorted[sorted.length - 1]?.timestamp ?? 0;

  const queueSustainClip = (channel: number, note: ActiveNote) => {
    const queue = pendingSustain.get(channel) ?? [];
    queue.push(note);
    pendingSustain.set(channel, queue);
  };

  const releaseSustain = (channel: number, timestamp: number) => {
    const queue = pendingSustain.get(channel);
    if (!queue || queue.length === 0) {
      return;
    }
    while (queue.length > 0) {
      const note = queue.shift();
      if (note) {
        clips.push(makeClip(note, timestamp));
      }
    }
  };

  sorted.forEach((event) => {
    lastTimestamp = Math.max(lastTimestamp, event.timestamp);

    if (event.type === "noteOn") {
      const assignedTrackId = resolveTrackId(trackIdMap.get(event.noteId) ?? finalTrackId);
      trackIdMap.set(event.noteId, assignedTrackId);
      const note: ActiveNote = {
        noteId: event.noteId,
        noteNumber: event.noteNumber,
        startMs: event.timestamp,
        velocity: event.velocity,
        channel: event.channel,
        trackId: assignedTrackId,
        patternId: event.patternId, // Extract patternId from event
      };

      activeNotesById.set(event.noteId, note);

      const key = mapKey(event.channel, event.noteNumber);
      const stack = activeStacksByKey.get(key) ?? [];
      stack.push(note);
      activeStacksByKey.set(key, stack);
      return;
    }

    if (event.type === "noteOff") {
      let note = activeNotesById.get(event.noteId);

      if (note) {
        activeNotesById.delete(event.noteId);
        const key = mapKey(note.channel, note.noteNumber);
        const stack = activeStacksByKey.get(key);
        if (stack) {
          const idx = stack.findIndex((item) => item.noteId === note.noteId);
          if (idx !== -1) {
            stack.splice(idx, 1);
          }
          if (stack.length === 0) {
            activeStacksByKey.delete(key);
          } else {
            activeStacksByKey.set(key, stack);
          }
        }
      } else {
        const key = mapKey(event.channel, event.noteNumber);
        const stack = activeStacksByKey.get(key);
        if (stack && stack.length > 0) {
          note = stack.pop();
          if (note) {
            activeNotesById.delete(note.noteId);
          }
          if (stack.length === 0) {
            activeStacksByKey.delete(key);
          } else {
            activeStacksByKey.set(key, stack);
          }
        }
      }

      if (!note) {
        return;
      }

      const rawClip = makeClip(note, event.timestamp);
      clipsWithoutSustain.push(rawClip);

      const pedalDown = sustainState.get(event.channel) ?? false;
      if (pedalDown) {
        queueSustainClip(event.channel, note);
      } else {
        clips.push(rawClip);
      }
      return;
    }

    if (event.type === "cc") {
      controlEvents.push({
        id: event.id,
        timestamp: event.timestamp,
        controller: event.controller,
        value: event.value,
        channel: event.channel,
      });

      if (event.controller === 64) {
        const pedalDown = event.value >= 64;
        const wasDown = sustainState.get(event.channel) ?? false;
        sustainState.set(event.channel, pedalDown);
        if (!pedalDown && wasDown) {
          releaseSustain(event.channel, event.timestamp);
        }
      }
    }
  });

  // Close any still-active notes with tail padding
  const tailTimestamp = lastTimestamp + TAIL_PADDING_MS;
  activeNotesById.forEach((note) => {
    const clip = makeClip(note, tailTimestamp);
    clipsWithoutSustain.push(clip);
    clips.push(clip);
  });

  sustainState.forEach((pedalDown, channel) => {
    if (!pedalDown) {
      releaseSustain(channel, lastTimestamp);
    } else {
      releaseSustain(channel, tailTimestamp);
    }
  });

  pendingSustain.forEach((queue, channel) => {
    if (queue.length > 0) {
      releaseSustain(channel, tailTimestamp);
    }
  });

  clips.sort((a, b) => a.start - b.start || a.noteNumber - b.noteNumber);
  clipsWithoutSustain.sort((a, b) => a.start - b.start || a.noteNumber - b.noteNumber);

  return { clips, clipsWithoutSustain, controlEvents };
};

export const buildIncrementalState = (state?: IncrementalDeriveState): IncrementalDeriveState => ({
  activeNotes: state?.activeNotes ? new Map(state.activeNotes) : new Map<string, ActiveNote[]>(),
  pendingSustain: state?.pendingSustain
    ? new Map(state.pendingSustain)
    : new Map<number, ActiveNote[]>(),
  sustainState: state?.sustainState ? new Map(state.sustainState) : new Map<number, boolean>(),
});

export const deriveIncremental = (
  newEvents: MidiDomainEvent[],
  trackId: string,
  state?: IncrementalDeriveState,
): IncrementalDeriveResult => {
  const { activeNotes, pendingSustain, sustainState } = buildIncrementalState(state);
  const assignedTrackId = resolveTrackId(trackId);

  const newClips: MidiNoteClip[] = [];
  const newClipsWithoutSustain: MidiNoteClip[] = [];
  const controlEvents: MidiControlChangeEvent[] = [];

  const queueSustainClip = (channel: number, note: ActiveNote) => {
    const queue = pendingSustain.get(channel) ?? [];
    queue.push(note);
    pendingSustain.set(channel, queue);
  };

  const releaseSustain = (channel: number, timestamp: number) => {
    const queue = pendingSustain.get(channel);
    if (!queue || queue.length === 0) {
      return;
    }
    while (queue.length > 0) {
      const note = queue.shift();
      if (note) {
        newClips.push(makeClip(note, timestamp));
      }
    }
  };

  newEvents.forEach((event) => {
    if (event.type === "noteOn") {
      const note: ActiveNote = {
        noteId: event.noteId,
        noteNumber: event.noteNumber,
        startMs: event.timestamp,
        velocity: event.velocity,
        channel: event.channel,
        trackId: assignedTrackId,
        patternId: event.patternId, // Extract patternId from event
      };

      const key = mapKey(event.channel, event.noteNumber);
      const stack = activeNotes.get(key) ?? [];
      stack.push(note);
      activeNotes.set(key, stack);
      return;
    }

    if (event.type === "noteOff") {
      const key = mapKey(event.channel, event.noteNumber);
      const stack = activeNotes.get(key);
      if (!stack || stack.length === 0) {
        return;
      }

      const note = stack.pop();
      if (!note) {
        return;
      }

      const rawClip = makeClip(note, event.timestamp);
      newClipsWithoutSustain.push(rawClip);

      const pedalDown = sustainState.get(event.channel) ?? false;
      if (pedalDown) {
        queueSustainClip(event.channel, note);
      } else {
        newClips.push(rawClip);
      }

      if (stack.length === 0) {
        activeNotes.delete(key);
      } else {
        activeNotes.set(key, stack);
      }
      return;
    }

    if (event.type === "cc") {
      controlEvents.push({
        id: event.id,
        timestamp: event.timestamp,
        controller: event.controller,
        value: event.value,
        channel: event.channel,
      });

      if (event.controller === 64) {
        const pedalDown = event.value >= 64;
        const wasDown = sustainState.get(event.channel) ?? false;
        sustainState.set(event.channel, pedalDown);
        if (!pedalDown && wasDown) {
          releaseSustain(event.channel, event.timestamp);
        }
      }
    }
  });

  return {
    newClips,
    newClipsWithoutSustain,
    controlEvents,
    state: {
      activeNotes,
      pendingSustain,
      sustainState,
    },
  };
};
