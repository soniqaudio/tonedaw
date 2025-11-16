export type MidiAccessState = "initial" | "requesting" | "granted" | "denied" | "error";

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer?: string;
  type: "input" | "output";
  state: MIDIPortConnectionState;
}

export interface MidiNoteEvent {
  id: string;
  timestamp: number;
  type: "noteon" | "noteoff";
  noteNumber: number;
  velocity: number;
  channel: number;
  noteId: string;
}

export interface MidiControlChangeEvent {
  id: string;
  timestamp: number;
  controller: number;
  value: number;
  channel: number;
}

export type MidiDomainEvent =
  | {
      id: string;
      type: "noteOn";
      timestamp: number;
      noteNumber: number;
      velocity: number;
      channel: number;
      noteId: string;
      trackId?: string; // Track this note belongs to
      patternId?: string; // Pattern this note belongs to
    }
  | {
      id: string;
      type: "noteOff";
      timestamp: number;
      noteNumber: number;
      velocity: number;
      channel: number;
      noteId: string;
      trackId?: string; // Track this note belongs to
      patternId?: string; // Pattern this note belongs to
    }
  | {
      id: string;
      type: "cc";
      timestamp: number;
      controller: number;
      value: number;
      channel: number;
    };

export interface MidiNoteClip {
  id: string;
  noteNumber: number;
  noteName: string;
  channel: number;
  velocity: number | undefined;
  start: number;
  duration: number;
  trackId: string; // Which track this clip belongs to
  patternId?: string; // Which pattern this clip belongs to (optional for FL Studio-style patterns)
}

export interface MidiRecorderState {
  isRecording: boolean;
  startedAt?: number;
  events: MidiDomainEvent[];
  noteEvents: MidiNoteEvent[];
  controlEvents: MidiControlChangeEvent[];
  clips: MidiNoteClip[];
  clipsWithoutSustain: MidiNoteClip[];
}
