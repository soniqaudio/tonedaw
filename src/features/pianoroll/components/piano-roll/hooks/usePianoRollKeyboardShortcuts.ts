import { useEffect } from "react";
import type { MidiNoteClip } from "@/core/midi/types";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { useUIStore } from "@/core/stores/useUIStore";

interface UsePianoRollKeyboardShortcutsProps {
  msPerBeat: number;
  quantizationBeats: number;
  activeTrackClips: MidiNoteClip[];
  selectedClipIds: string[];
  setSelectedClipIds: (ids: string[]) => void;
  updateClips: (updates: Array<{ id: string; start: number; noteNumber: number }>) => void;
}

/**
 * Handles keyboard shortcuts for the piano roll.
 *
 * Shortcuts:
 * - Cmd/Ctrl + Arrow Up/Down: Move notes by semitone (Shift: octave)
 * - Cmd/Ctrl + Arrow Left/Right: Move notes in time
 * - Cmd/Ctrl + E: Quantize to grid
 * - Cmd/Ctrl + C: Copy
 * - Cmd/Ctrl + X: Cut
 * - Cmd/Ctrl + V: Paste
 * - Cmd/Ctrl + A: Select all
 */
export const usePianoRollKeyboardShortcuts = ({
  msPerBeat,
  quantizationBeats,
  activeTrackClips,
  selectedClipIds,
  setSelectedClipIds,
  updateClips,
}: UsePianoRollKeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      // Ignore shortcuts when typing in input fields
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        const isTextInput =
          tagName === "TEXTAREA" ||
          target.isContentEditable ||
          (tagName === "INPUT" && (target as HTMLInputElement).type === "text");

        if (isTextInput) {
          return;
        }
      }

      const usesModifier = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      
      // K: Toggle cut tool (check early, before modifier check)
      if (usesModifier && key === "k") {
        event.preventDefault();
        useUIStore.getState().actions.toggleCutTool();
        return;
      }

      if (!usesModifier) return;

      // Arrow Up/Down: Move notes vertically (pitch)
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? 1 : -1;
        const semitoneStep = event.shiftKey ? 12 : 1;
        const delta = direction * semitoneStep;

        if (selectedClipIds.length === 0) return;
        const selectedClips = activeTrackClips.filter((clip) => selectedClipIds.includes(clip.id));
        if (selectedClips.length === 0) return;

        const updates = selectedClips.map((clip) => ({
          id: clip.id,
          start: clip.start,
          noteNumber: clip.noteNumber + delta,
        }));
        updateClips(updates);
        return;
      }

      // Arrow Left/Right: Move notes horizontally (time)
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        if (selectedClipIds.length === 0) return;

        const selectedClips = activeTrackClips.filter((clip) => selectedClipIds.includes(clip.id));
        if (selectedClips.length === 0) return;

        const direction = event.key === "ArrowRight" ? 1 : -1;
        const stepMs = quantizationBeats * msPerBeat;

        const updates = selectedClips.map((clip) => {
          const newStart = Math.max(0, clip.start + direction * stepMs);
          return {
            id: clip.id,
            start: newStart,
            noteNumber: clip.noteNumber,
          };
        });

        updateClips(updates);
        return;
      }

      const actions = useMidiStore.getState().actions;

      // E: Quantize selected notes
      if (key === "e") {
        event.preventDefault();
        if (selectedClipIds.length === 0) return;

        const selectedClips = activeTrackClips.filter((clip) => selectedClipIds.includes(clip.id));
        if (selectedClips.length === 0) return;

        const updates = selectedClips.map((clip) => {
          const startBeats = clip.start / msPerBeat;
          const snappedBeats = Math.round(startBeats / quantizationBeats) * quantizationBeats;
          const snappedMs = Math.max(0, snappedBeats * msPerBeat);
          return {
            id: clip.id,
            start: snappedMs,
            noteNumber: clip.noteNumber,
          };
        });

        updateClips(updates);
        return;
      }

      // C: Copy
      if (key === "c") {
        event.preventDefault();
        actions.copySelectedClips();
        return;
      }

      // X: Cut
      if (key === "x") {
        event.preventDefault();
        actions.cutSelectedClips();
        return;
      }

      // V: Paste
      if (key === "v") {
        event.preventDefault();
        const pointer = useUIStore.getState().pianoRollPointer;
        const pointerMs = pointer?.ms ?? 0;
        const pointerNote = pointer?.noteNumber ?? 60;

        const beats = pointerMs / msPerBeat;
        const quantizedBeatsValue = Math.round(beats / quantizationBeats) * quantizationBeats;
        const startMs = Math.max(0, quantizedBeatsValue * msPerBeat);

        actions.pasteClipsAt(startMs, pointerNote);
        return;
      }

      // A: Select all
      if (key === "a") {
        event.preventDefault();
        const allClipIds = activeTrackClips.map((clip) => clip.id);
        setSelectedClipIds(allClipIds);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    msPerBeat,
    quantizationBeats,
    activeTrackClips,
    setSelectedClipIds,
    selectedClipIds,
    updateClips,
  ]);
};
