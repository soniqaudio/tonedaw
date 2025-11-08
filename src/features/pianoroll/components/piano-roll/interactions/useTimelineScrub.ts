import { useCallback, useRef } from "react";
import { clientToLocalRect } from "../lib/coords";

interface UseTimelineScrubProps {
  containerRef: React.RefObject<HTMLDivElement>;
  timelineContainerRef: React.RefObject<HTMLDivElement>;
  gridContainerRef: React.RefObject<HTMLDivElement>;
  gridWidth: number;
  pixelsPerBeat: number;
  msPerBeat: number;
  setPlayheadMs: (ms: number) => void;
  isPlaying: boolean;
  pause: () => void;
  scrollLeft: number;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}

export const useTimelineScrub = ({
  containerRef,
  timelineContainerRef,
  gridContainerRef,
  gridWidth,
  pixelsPerBeat,
  msPerBeat,
  setPlayheadMs,
  isPlaying,
  pause,
  scrollLeft,
  onScrubStart,
  onScrubEnd,
}: UseTimelineScrubProps) => {
  const isScrubbingRef = useRef(false);
  const scrubSourceRef = useRef<"timeline" | "grid">("timeline");

  // Update playhead position from client X coordinate
  const updatePlayheadFromClientX = useCallback(
    (clientX: number, source: "timeline" | "grid") => {
      const container = containerRef.current;
      const targetRect =
        source === "timeline"
          ? timelineContainerRef.current?.getBoundingClientRect()
          : gridContainerRef.current?.getBoundingClientRect();

      if (!container || !targetRect) return;

      const { localX } = clientToLocalRect(clientX, 0, targetRect);
      let position: number;

      if (source === "timeline") {
        position = scrollLeft + localX;
      } else {
        // Grid uses absolute positioning (world coordinates)
        position = localX + container.scrollLeft;
      }

      const clamped = Math.max(0, Math.min(gridWidth, position));
      const targetMs = (clamped / pixelsPerBeat) * msPerBeat;
      setPlayheadMs(targetMs);
    },
    [
      gridWidth,
      msPerBeat,
      pixelsPerBeat,
      setPlayheadMs,
      containerRef,
      timelineContainerRef,
      gridContainerRef,
      scrollLeft,
    ],
  );

  // Handle pointer move during scrubbing
  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!isScrubbingRef.current) return;
      updatePlayheadFromClientX(event.clientX, scrubSourceRef.current);
    },
    [updatePlayheadFromClientX],
  );

  // Handle pointer up during scrubbing
  const handleScrubUp = useCallback(() => {
    isScrubbingRef.current = false;
    onScrubEnd?.();
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handleScrubUp);
  }, [handlePointerMove, onScrubEnd]);

  // Start scrubbing
  const startScrub = useCallback(
    (clientX: number, source: "timeline" | "grid") => {
      scrubSourceRef.current = source;
      isScrubbingRef.current = true;

      // Pause playback while scrubbing
      if (isPlaying) {
        pause();
      }

      onScrubStart?.();
      updatePlayheadFromClientX(clientX, source);
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handleScrubUp);
    },
    [handlePointerMove, handleScrubUp, isPlaying, pause, updatePlayheadFromClientX, onScrubStart],
  );

  // Cancel scrubbing (cleanup)
  const cancelScrub = useCallback(() => {
    if (isScrubbingRef.current) {
      isScrubbingRef.current = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handleScrubUp);
      onScrubEnd?.();
    }
  }, [handlePointerMove, handleScrubUp, onScrubEnd]);

  const isScrubbing = useCallback(() => isScrubbingRef.current, []);

  return {
    startScrub,
    isScrubbing,
    cancelScrub,
  };
};
