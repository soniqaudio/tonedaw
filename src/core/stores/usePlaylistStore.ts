import { create } from "zustand";

export interface PlaylistClip {
  id: string;
  patternId?: string; // Reference to pattern (for pattern clips)
  trackId: string; // Which track this clip is on
  start: number; // Start position in bars
  length: number; // Length in bars
  label: string; // Display name
  type: "Pattern" | "Audio"; // Clip type
}

interface PlaylistState {
  clips: PlaylistClip[];
  actions: {
    addClip: (clip: Omit<PlaylistClip, "id">) => string; // Returns new clip ID
    removeClip: (clipId: string) => void;
    updateClip: (clipId: string, updates: Partial<Omit<PlaylistClip, "id">>) => void;
    moveClip: (clipId: string, newStart: number) => void;
    resizeClip: (clipId: string, newLength: number) => void;
    getClipsByTrack: (trackId: string) => PlaylistClip[];
  };
}

const generateClipId = () => `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  clips: [],
  actions: {
    addClip: (clipData) => {
      const newClip: PlaylistClip = {
        id: generateClipId(),
        ...clipData,
      };
      set((state) => ({
        clips: [...state.clips, newClip],
      }));
      return newClip.id;
    },
    removeClip: (clipId) =>
      set((state) => ({
        clips: state.clips.filter((c) => c.id !== clipId),
      })),
    updateClip: (clipId, updates) =>
      set((state) => ({
        clips: state.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
      })),
    moveClip: (clipId, newStart) =>
      set((state) => ({
        clips: state.clips.map((c) => (c.id === clipId ? { ...c, start: newStart } : c)),
      })),
    resizeClip: (clipId, newLength) =>
      set((state) => ({
        clips: state.clips.map((c) => (c.id === clipId ? { ...c, length: newLength } : c)),
      })),
    getClipsByTrack: (trackId) => {
      return get().clips.filter((c) => c.trackId === trackId);
    },
  },
}));

