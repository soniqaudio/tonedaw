import { useCallback } from "react";
import { MUSIC, PIANO_ROLL } from "@/core/constants";
import type { MidiNoteClip } from "@/core/midi/types";
import { generateClipId } from "@/core/utils/id";
import { getActiveTrackId } from "@/core/utils/trackUtils";
import { getOrCreateEditingPattern, updatePatternClipLengths } from "@/core/utils/patternUtils";

interface UseNoteCreationProps {
  pianoKeys: Array<{ note: string; isBlack: boolean; midi: number }>;
  addClip: (clip: MidiNoteClip) => void;
  msPerBeat: number;
  quantizationBeats: number;
  defaultDurationBeats: number;
}

export const useNoteCreation = ({
  pianoKeys,
  addClip,
  msPerBeat,
  quantizationBeats,
  defaultDurationBeats,
}: UseNoteCreationProps) => {
  // Create a note at the given position
  const createNoteAt = useCallback(
    async (pointerMs: number, noteIndex: number) => {
      const clampedNoteIndex = Math.max(0, Math.min(pianoKeys.length - 1, noteIndex));
      const pianoKey = pianoKeys[clampedNoteIndex];
      if (!pianoKey) return;

      const noteNumber = pianoKey.midi;

      // Quantize to grid
      const quantizedBeats =
        Math.round(pointerMs / msPerBeat / quantizationBeats) * quantizationBeats;
      const startMs = Math.max(0, quantizedBeats * msPerBeat);
      const trackId = getActiveTrackId();
      const patternId = getOrCreateEditingPattern(); // Auto-create pattern if needed

      const clip: MidiNoteClip = {
        id: generateClipId(noteNumber, startMs),
        noteNumber,
        noteName: pianoKey.note,
        channel: 0,
        velocity: MUSIC.DEFAULT_VELOCITY,
        start: startMs,
        duration: defaultDurationBeats * msPerBeat,
        trackId,
        patternId,
      };

      addClip(clip);

      // Update playlist clip length based on pattern content
      // Use setTimeout to ensure the clip has been added to the store first
      setTimeout(() => {
        updatePatternClipLengths(patternId);
      }, 0);

      // Play the note sound immediately
      const { audioEngine } = await import("@/core/audio/audioEngine");
      await audioEngine.resume();
      audioEngine.noteOn(noteNumber, MUSIC.DEFAULT_VELOCITY, trackId);

      // Release after a short duration
      setTimeout(() => {
        audioEngine.noteOff(noteNumber, trackId);
      }, PIANO_ROLL.NOTE_PREVIEW_DURATION_MS);
    },
    [pianoKeys, addClip, msPerBeat, quantizationBeats, defaultDurationBeats],
  );

  return {
    createNoteAt,
  };
};
