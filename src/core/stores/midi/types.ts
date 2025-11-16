import type { Midi } from "@tonejs/midi";
import type {
  MidiAccessState,
  MidiControlChangeEvent,
  MidiDeviceInfo,
  MidiDomainEvent,
  MidiNoteClip,
  MidiNoteEvent,
} from "@/core/midi/types";

export type MidiStatus = "idle" | "loading" | "ready" | "error";

export interface MidiState {
  midi: Midi | null;
  status: MidiStatus;
  error?: string;
  devices: MidiDeviceInfo[];
  selectedInputId?: string;
  liveEvents: MidiNoteEvent[];
  isRecording: boolean;
  recordArm: boolean;
  computerInputEnabled: boolean;
  clips: MidiNoteClip[];
  clipsWithoutSustain: MidiNoteClip[];
  events: MidiDomainEvent[];
  controlEvents: MidiControlChangeEvent[];
  selectedClipIds: string[];
  midiAccessState: MidiAccessState;
  midiAccessError?: string;
  midiAccessRequestToken: number;
  recordingPreviewClips: MidiNoteClip[];
  recordingPreviewMeta: Record<string, { startMs: number }>;
  actions: {
    // File operations
    loadFromArrayBuffer: (buffer: ArrayBuffer) => Promise<void>;
    reset: () => void;

    // Device management
    setDevices: (devices: MidiDeviceInfo[]) => void;
    selectInput: (deviceId?: string) => void;
    setMidiAccessState: (state: MidiAccessState) => void;
    setMidiAccessError: (message: string | undefined) => void;
    triggerMidiAccessRequest: () => void;

    // Event management
    setLiveEvents: (events: MidiNoteEvent[]) => void;
    appendEvents: (events: MidiDomainEvent[], trackId: string) => void;
    scaleTimeline: (ratio: number) => void;

    // Recording
    setRecording: (value: boolean) => void;
    setRecordArm: (value: boolean) => void;
    setComputerInputEnabled: (value: boolean) => void;

    // Clip CRUD
    addClip: (clip: MidiNoteClip) => void;
    removeClip: (clipId: string) => void;
    updateClipDuration: (clipId: string, newDuration: number) => void;
    updateClips: (
      updates: Array<{
        id: string;
        start: number;
        noteNumber: number;
      }>,
    ) => void;
    updateClipVelocity: (clipIds: string[], velocity: number) => void;
    setSelectedClipIds: (ids: string[]) => void;
    splitClipAt: (clipId: string, cutMs: number) => void;

    // Clipboard
    copySelectedClips: () => void;
    cutSelectedClips: () => void;
    pasteClipsAt: (targetMs: number, targetNoteNumber: number) => void;

    // Recording previews
    beginRecordingPreview: (payload: {
      noteId: string;
      noteNumber: number;
      startMs: number;
      velocity: number;
      channel: number;
      trackId: string;
      patternId?: string;
    }) => void;
    updateRecordingPreviews: (currentMs: number) => void;
    endRecordingPreview: (noteId: string) => void;
    clearRecordingPreviews: () => void;
  };
}
