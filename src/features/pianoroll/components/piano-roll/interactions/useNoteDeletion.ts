import { useCallback } from "react";
import type { MidiNoteClip } from "@/core/midi/types";
import { updatePatternClipLengths } from "@/core/utils/patternUtils";

interface UseNoteDeletionProps {
  clips: MidiNoteClip[];
  removeClip: (clipId: string) => void;
  pianoKeys: Array<{ note: string; isBlack: boolean; midi: number }>;
}

export const useNoteDeletion = ({ clips, removeClip, pianoKeys }: UseNoteDeletionProps) => {
  // Delete note at the given position (if one exists)
  const deleteNoteAt = useCallback(
    (pointerMs: number, noteIndex: number) => {
      const clampedNoteIndex = Math.max(0, Math.min(pianoKeys.length - 1, noteIndex));
      const pianoKey = pianoKeys[clampedNoteIndex];
      if (!pianoKey) return;

      const noteNumber = pianoKey.midi;

      // Find the topmost clip at this position (reverse order)
      const clipToRemove = [...clips]
        .reverse()
        .find(
          (clip) =>
            clip.noteNumber === noteNumber &&
            pointerMs >= clip.start &&
            pointerMs <= clip.start + clip.duration,
        );

      if (clipToRemove) {
        const patternId = clipToRemove.patternId;
        removeClip(clipToRemove.id);
        
        // Update playlist clip length if note belonged to a pattern
        // Use setTimeout to ensure the clip has been removed from the store first
        if (patternId) {
          setTimeout(() => {
            updatePatternClipLengths(patternId);
          }, 0);
        }
      }
    },
    [clips, removeClip, pianoKeys],
  );

  return {
    deleteNoteAt,
  };
};
