"use client";

import { useCallback, useRef } from "react";
import type { MidiNoteClip } from "@/core/midi/types";

interface PianoKey {
  note: string;
  isBlack: boolean;
  midi: number;
}

interface OriginalClipState {
  clipId: string;
  start: number;
  duration: number;
  noteIndex: number;
  noteNumber: number;
}

interface MovementConfig {
  pianoKeys: PianoKey[];
  keyHeight: number;
  msPerBeat: number;
  pixelsPerBeat: number;
  containerRef: React.RefObject<HTMLDivElement>;
  gridContainerRef: React.RefObject<HTMLDivElement>;
  updateClips: (
    updates: Array<{
      id: string;
      start: number;
      noteNumber: number;
    }>,
  ) => void;
}

interface BeginMoveArgs {
  event: React.PointerEvent<HTMLDivElement>;
  bodyClip: MidiNoteClip;
  clips: MidiNoteClip[];
  selectedClipIds: string[];
  pointerWorldX: number;
  clampedNoteIndex: number;
}

interface MoveState {
  pointerId: number;
  baseClipId: string;
  baseStartMs: number;
  baseNoteIndex: number;
  pointerOffsetMs: number;
  pointerNoteOffset: number;
  minNoteDelta: number;
  maxNoteDelta: number;
  appliedDeltaMs: number;
  appliedDeltaNotes: number;
  originals: OriginalClipState[];
}

export const useNoteMovement = ({
  pianoKeys,
  keyHeight,
  msPerBeat,
  pixelsPerBeat,
  containerRef,
  gridContainerRef,
  updateClips,
}: MovementConfig) => {
  const moveStateRef = useRef<MoveState | null>(null);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const state = moveStateRef.current;
      if (!state) return;

      event.preventDefault();
      event.stopPropagation();

      const gridRect = gridContainerRef.current?.getBoundingClientRect();
      const container = containerRef.current;
      if (!gridRect || !container) return;

      const localX = event.clientX - gridRect.left;
      const localY = event.clientY - gridRect.top;

      const worldX = localX + container.scrollLeft;
      const worldY = localY;

      // worldX is in pixels, convert to beats then to ms
      const worldXBeats = worldX / pixelsPerBeat;
      const worldXMs = worldXBeats * msPerBeat;

      // Calculate where the base clip should start (NO quantization during drag for smooth movement)
      const rawBaseStart = worldXMs - state.pointerOffsetMs;
      const snappedBaseStartMs = Math.max(0, rawBaseStart);
      const deltaMs = snappedBaseStartMs - state.baseStartMs;

      const pointerIndex = Math.floor(worldY / keyHeight);
      const clampedPointerIndex = Math.max(0, Math.min(pianoKeys.length - 1, pointerIndex));
      const targetBaseIndex = Math.max(
        0,
        Math.min(pianoKeys.length - 1, clampedPointerIndex - state.pointerNoteOffset),
      );

      let deltaNotes = targetBaseIndex - state.baseNoteIndex;
      deltaNotes = Math.max(state.minNoteDelta, Math.min(state.maxNoteDelta, deltaNotes));

      if (deltaMs === state.appliedDeltaMs && deltaNotes === state.appliedDeltaNotes) {
        return;
      }

      const updates = state.originals.map((clip) => {
        const nextStart = Math.max(0, clip.start + deltaMs);
        const nextIndex = Math.max(0, Math.min(pianoKeys.length - 1, clip.noteIndex + deltaNotes));

        return {
          id: clip.clipId,
          start: nextStart,
          noteNumber: pianoKeys[nextIndex].midi,
        };
      });

      updateClips(updates);
      state.appliedDeltaMs = deltaMs;
      state.appliedDeltaNotes = deltaNotes;
    },
    [gridContainerRef, containerRef, msPerBeat, pixelsPerBeat, keyHeight, pianoKeys, updateClips],
  );

  const handlePointerUp = useCallback(
    (_event?: PointerEvent) => {
      if (moveStateRef.current) {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        moveStateRef.current = null;
      }

      const container = containerRef.current;
      if (container) {
        container.style.cursor = "crosshair";
      }
    },
    [containerRef, handlePointerMove],
  );

  const tryBeginMove = useCallback(
    ({
      event,
      bodyClip,
      clips,
      selectedClipIds,
      pointerWorldX,
      clampedNoteIndex,
    }: BeginMoveArgs) => {
      const container = containerRef.current;
      const gridElement = gridContainerRef.current;
      if (!container || !gridElement) {
        return false;
      }

      const activeSelection = selectedClipIds.length ? selectedClipIds : [bodyClip.id];

      const baseClip = clips.find((clip) => clip.id === bodyClip.id);
      if (!baseClip) {
        return false;
      }

      const baseNoteIndex = Math.max(
        0,
        Math.min(
          pianoKeys.length - 1,
          pianoKeys.findIndex((key) => key.note === baseClip.noteName),
        ),
      );

      const pointerNoteOffset = clampedNoteIndex - baseNoteIndex;

      const originals: OriginalClipState[] = activeSelection
        .map((clipId) => {
          const clip = clips.find((c) => c.id === clipId);
          if (!clip) return null;
          const noteIndex = Math.max(
            0,
            Math.min(
              pianoKeys.length - 1,
              pianoKeys.findIndex((key) => key.note === clip.noteName),
            ),
          );
          return {
            clipId,
            start: clip.start,
            duration: clip.duration,
            noteIndex,
            noteNumber: clip.noteNumber,
          };
        })
        .filter((value): value is OriginalClipState => value != null);

      if (originals.length === 0) {
        return false;
      }

      const minIndex = originals.reduce(
        (min, clip) => (clip.noteIndex < min ? clip.noteIndex : min),
        originals[0].noteIndex,
      );
      const maxIndex = originals.reduce(
        (max, clip) => (clip.noteIndex > max ? clip.noteIndex : max),
        originals[0].noteIndex,
      );

      // Convert pointer offset from pixels to ms
      const pointerWorldXMs = (pointerWorldX / pixelsPerBeat) * msPerBeat;

      moveStateRef.current = {
        pointerId: event.pointerId,
        baseClipId: bodyClip.id,
        baseStartMs: baseClip.start,
        baseNoteIndex,
        pointerOffsetMs: pointerWorldXMs - baseClip.start,
        pointerNoteOffset,
        minNoteDelta: -minIndex,
        maxNoteDelta: pianoKeys.length - 1 - maxIndex,
        appliedDeltaMs: 0,
        appliedDeltaNotes: 0,
        originals,
      };

      // DON'T use setPointerCapture - it might be causing early termination
      // Just use window event listeners
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);

      container.style.cursor = "grabbing";

      return true;
    },
    [
      containerRef,
      gridContainerRef,
      handlePointerMove,
      handlePointerUp,
      pianoKeys,
      pixelsPerBeat,
      msPerBeat,
    ],
  );

  const cancelMove = useCallback(() => {
    if (moveStateRef.current) {
      handlePointerUp();
    }
  }, [handlePointerUp]);

  return {
    tryBeginMove,
    isMoving: () => moveStateRef.current !== null,
    cancelMove,
  };
};
