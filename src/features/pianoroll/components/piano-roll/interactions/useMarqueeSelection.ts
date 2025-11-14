import { useCallback, useEffect, useRef, useState } from "react";
import type { MidiNoteClip } from "@/core/midi/types";

interface UseMarqueeSelectionProps {
  clips: MidiNoteClip[];
  gridContainerRef: React.RefObject<HTMLDivElement>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  scrollLeft: number;
  pixelsPerBeat: number;
  msPerBeat: number;
  keyHeight: number;
  noteToIndex: Map<string, number>;
  setSelectedClipIds: (ids: string[]) => void;
  onMarqueeStart?: () => void;
  onMarqueeEnd?: () => void;
}

interface MarqueeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startMs: number;
  endMs: number;
  startKey: number;
  endKey: number;
}

export interface SelectionRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const useMarqueeSelection = ({
  clips,
  gridContainerRef,
  containerRef,
  scrollLeft,
  pixelsPerBeat,
  msPerBeat,
  keyHeight,
  noteToIndex,
  setSelectedClipIds,
  onMarqueeStart,
  onMarqueeEnd,
}: UseMarqueeSelectionProps) => {
  const marqueeRef = useRef<MarqueeState | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const clipsRef = useRef(clips);

  // Keep clips ref up to date
  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  const toMs = useCallback(
    (worldX: number) => {
      const beats = worldX / Math.max(pixelsPerBeat, 0.0001);
      return beats * msPerBeat;
    },
    [msPerBeat, pixelsPerBeat],
  );

  const toKeyIndex = useCallback(
    (worldY: number) => {
      if (keyHeight <= 0) return 0;
      return Math.max(0, Math.floor(worldY / keyHeight));
    },
    [keyHeight],
  );

  const updateSelectionVisual = useCallback((state: MarqueeState) => {
    setSelectionRect({
      x0: Math.min(state.startX, state.endX),
      y0: Math.min(state.startY, state.endY),
      x1: Math.max(state.startX, state.endX),
      y1: Math.max(state.startY, state.endY),
    });
  }, []);

  // Handle pointer move during marquee selection
  const handleMarqueeMove = useCallback(
    (event: PointerEvent) => {
      if (!marqueeRef.current) return;

      const gridRect = gridContainerRef.current?.getBoundingClientRect();
      if (!gridRect) return;

      const localX = event.clientX - gridRect.left;
      const localY = event.clientY - gridRect.top;
      const currentScrollLeft = containerRef.current?.scrollLeft ?? scrollLeft;
      const worldX = localX + currentScrollLeft;
      const worldY = localY;

      marqueeRef.current.endX = worldX;
      marqueeRef.current.endY = worldY;
      marqueeRef.current.endMs = toMs(worldX);
      marqueeRef.current.endKey = toKeyIndex(worldY);
      updateSelectionVisual(marqueeRef.current);
    },
    [gridContainerRef, containerRef, scrollLeft, toMs, toKeyIndex, updateSelectionVisual],
  );

  // Select clips that intersect with marquee rectangle
  const selectIntersectingClips = useCallback(() => {
    if (!marqueeRef.current) return;

    const { startMs, endMs, startKey, endKey } = marqueeRef.current;
    const minMs = Math.min(startMs, endMs);
    const maxMs = Math.max(startMs, endMs);
    const minKeyIdx = Math.min(startKey, endKey);
    const maxKeyIdx = Math.max(startKey, endKey);

    const selectedIds: string[] = [];
    const currentClips = clipsRef.current ?? [];

    for (const clip of currentClips) {
      const clipStart = clip.start;
      const clipEnd = clip.start + clip.duration;
      const keyIdx = noteToIndex.get(clip.noteName);
      if (keyIdx === undefined) continue;

      const intersectsHorizontally = !(clipEnd < minMs || clipStart > maxMs);
      const intersectsVertically = keyIdx >= minKeyIdx && keyIdx <= maxKeyIdx;

      if (intersectsHorizontally && intersectsVertically) {
        selectedIds.push(clip.id);
      }
    }

    setSelectedClipIds(selectedIds);
  }, [noteToIndex, setSelectedClipIds]);

  // Handle pointer up during marquee selection
  const handleMarqueeUp = useCallback(() => {
    selectIntersectingClips();
    setSelectionRect(null);
    marqueeRef.current = null;
    onMarqueeEnd?.();
    window.removeEventListener("pointermove", handleMarqueeMove);
    window.removeEventListener("pointerup", handleMarqueeUp);
  }, [handleMarqueeMove, selectIntersectingClips, onMarqueeEnd]);

  // Start marquee selection
  const startMarquee = useCallback(
    (worldX: number, worldY: number) => {
      const currentScrollLeft = containerRef.current?.scrollLeft ?? scrollLeft;
      const adjustedX = worldX + (currentScrollLeft - scrollLeft);
      const startMs = toMs(adjustedX);
      const startKey = toKeyIndex(worldY);

      marqueeRef.current = {
        startX: adjustedX,
        startY: worldY,
        endX: adjustedX,
        endY: worldY,
        startMs,
        endMs: startMs,
        startKey,
        endKey: startKey,
      };
      updateSelectionVisual(marqueeRef.current);
      window.addEventListener("pointermove", handleMarqueeMove, true);
      window.addEventListener("pointerup", handleMarqueeUp, true);
      onMarqueeStart?.();
    },
    [containerRef, handleMarqueeMove, handleMarqueeUp, onMarqueeStart, scrollLeft, toKeyIndex, toMs, updateSelectionVisual],
  );

  // Cancel marquee (cleanup)
  const cancelMarquee = useCallback(() => {
    if (marqueeRef.current) {
      window.removeEventListener("pointermove", handleMarqueeMove);
      window.removeEventListener("pointerup", handleMarqueeUp);
      marqueeRef.current = null;
      setSelectionRect(null);
      onMarqueeEnd?.();
    }
  }, [handleMarqueeMove, handleMarqueeUp, onMarqueeEnd]);

  const isMarqueeActive = useCallback(() => marqueeRef.current !== null, []);

  return {
    startMarquee,
    selectionRect,
    isMarqueeActive,
    cancelMarquee,
  };
};
