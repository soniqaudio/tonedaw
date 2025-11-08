import { useCallback, useRef } from "react";
import type { MidiNoteClip } from "@/core/midi/types";
import type { ClipRect } from "../hooks/useGridCoordinates";

interface UseNoteResizeProps {
  clips: MidiNoteClip[];
  selectedClipIds: string[];
  gridContainerRef: React.RefObject<HTMLDivElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  scrollLeft: number;
  pixelsPerBeat: number;
  msPerBeat: number;
  quantizationBeats: number;
  updateClipDuration: (clipId: string, newDuration: number) => void;
  getClipRectPx: (clip: MidiNoteClip) => ClipRect | null;
  isNearRightEdge: (worldX: number, clipRect: ClipRect) => boolean;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

interface ResizeState {
  clipId: string;
  startBeats: number;
  origDurationBeats: number;
  isMultiResize: boolean;
  selectedClips?: Array<{
    clipId: string;
    origDuration: number;
  }>;
}

export const useNoteResize = ({
  clips,
  selectedClipIds,
  gridContainerRef,
  containerRef,
  scrollLeft,
  pixelsPerBeat,
  msPerBeat,
  quantizationBeats,
  updateClipDuration,
  getClipRectPx,
  isNearRightEdge,
  onResizeStart,
  onResizeEnd,
}: UseNoteResizeProps) => {
  const resizingRef = useRef<ResizeState | null>(null);

  // Find if pointer is near right edge of any clip
  const findRightEdgeHit = useCallback(
    (worldX: number, worldY: number) => {
      // Check clips from front to back (reverse order) for topmost clip
      for (let i = clips.length - 1; i >= 0; i--) {
        const rect = getClipRectPx(clips[i]);
        if (!rect) continue;

        if (worldY >= rect.top && worldY <= rect.bottom) {
          if (isNearRightEdge(worldX, rect)) {
            return { clip: clips[i], rect };
          }
        }
      }
      return null;
    },
    [clips, getClipRectPx, isNearRightEdge],
  );

  // Handle pointer move during resize
  const handleResizeMove = useCallback(
    (event: PointerEvent) => {
      if (!resizingRef.current) return;

      const gridRect = gridContainerRef.current?.getBoundingClientRect();
      if (!gridRect) return;

      const localX = event.clientX - gridRect.left;
      const worldX = localX + scrollLeft;

      const { clipId, startBeats, origDurationBeats, isMultiResize, selectedClips } =
        resizingRef.current;
      const endBeatsRaw = worldX / pixelsPerBeat;

      // Quantize and enforce minimum duration
      const endBeats = Math.max(
        startBeats + quantizationBeats,
        Math.round(endBeatsRaw / quantizationBeats) * quantizationBeats,
      );

      const newDuration = (endBeats - startBeats) * msPerBeat;
      const durationDelta = newDuration - origDurationBeats * msPerBeat;

      if (isMultiResize && selectedClips) {
        // Resize all selected clips by the same delta
        for (const selectedClip of selectedClips) {
          const newSelectedDuration = Math.max(
            quantizationBeats * msPerBeat, // Minimum duration
            selectedClip.origDuration + durationDelta,
          );
          updateClipDuration(selectedClip.clipId, newSelectedDuration);
        }
      } else {
        // Single clip resize
        updateClipDuration(clipId, newDuration);
      }
    },
    [gridContainerRef, scrollLeft, pixelsPerBeat, quantizationBeats, msPerBeat, updateClipDuration],
  );

  // Handle pointer up during resize
  const handleResizeUp = useCallback(() => {
    onResizeEnd?.();
    resizingRef.current = null;
    window.removeEventListener("pointermove", handleResizeMove, true);
    window.removeEventListener("pointerup", handleResizeUp, true);

    // Reset cursor
    if (containerRef.current) {
      containerRef.current.style.cursor = "crosshair";
    }
  }, [handleResizeMove, containerRef, onResizeEnd]);

  // Start resizing a clip
  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, clip: MidiNoteClip) => {
      const startBeats = clip.start / msPerBeat;
      const origDurationBeats = clip.duration / msPerBeat;

      const isMultiResize = selectedClipIds.includes(clip.id) && selectedClipIds.length > 1;

      const selectedClips = isMultiResize
        ? (selectedClipIds
            .map((id) => {
              const c = clips.find((clip) => clip.id === id);
              return c ? { clipId: id, origDuration: c.duration } : null;
            })
            .filter(Boolean) as Array<{ clipId: string; origDuration: number }>)
        : undefined;

      resizingRef.current = {
        clipId: clip.id,
        startBeats,
        origDurationBeats,
        isMultiResize,
        selectedClips,
      };

      window.addEventListener("pointermove", handleResizeMove, true);
      window.addEventListener("pointerup", handleResizeUp, true);

      onResizeStart?.();

      // Capture pointer to this element
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [clips, selectedClipIds, msPerBeat, handleResizeMove, handleResizeUp, onResizeStart],
  );

  // Cancel resize (cleanup)
  const cancelResize = useCallback(() => {
    if (resizingRef.current) {
      window.removeEventListener("pointermove", handleResizeMove, true);
      window.removeEventListener("pointerup", handleResizeUp, true);
      resizingRef.current = null;

      onResizeEnd?.();

      if (containerRef.current) {
        containerRef.current.style.cursor = "crosshair";
      }
    }
  }, [handleResizeMove, handleResizeUp, containerRef, onResizeEnd]);

  const isResizing = useCallback(() => resizingRef.current !== null, []);

  return {
    findRightEdgeHit,
    startResize,
    isResizing,
    cancelResize,
  };
};
