import { useEffect, useMemo, useRef, useState } from "react";
import { PIANO_ROLL } from "@/core/constants/pianoRoll";
import { useTransportStore } from "@/core/stores/useTransportStore";
import { useUIStore } from "@/core/stores/useUIStore";
import type { MidiNoteClip } from "@/core/midi/types";

const PIANO_KEYS_WIDTH_FALLBACK = 80;
const EXTRA_BEATS = 16;

interface UsePianoRollScrollSyncProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  pianoKeysRef: React.RefObject<HTMLDivElement | null>;
  pianoKeysWidthRef: React.MutableRefObject<number>;
  scrollLeft: number;
  scrollTop: number;
  activeTrackClips: MidiNoteClip[];
  effectiveViewportWidth: number;
  msPerBeat: number;
  pixelsPerBeat: number;
  playheadMs: number;
  isPlaying: boolean;
  followPlayhead: boolean;
  pianoRollScroll: { left: number; top: number };
  setPianoRollScroll: (scroll: { left: number; top: number }) => void;
  setPianoRollFollow: (follow: boolean) => void;
  fallbackViewportWidth: number;
}

interface UsePianoRollScrollSyncReturn {
  gridViewportWidth: number;
  gridExtraBeats: number;
  setGridExtraBeats: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * Manages scroll synchronization, viewport width calculations, and auto-scroll during playback.
 *
 * Features:
 * - Restores saved scroll position on mount
 * - Syncs scroll position to store
 * - Disables follow mode on manual scroll
 * - Auto-scrolls during playback to keep playhead visible
 * - Dynamically expands grid as user scrolls
 * - Measures and tracks piano keys width
 */
export const usePianoRollScrollSync = ({
  containerRef,
  pianoKeysRef,
  pianoKeysWidthRef,
  scrollLeft,
  scrollTop,
  activeTrackClips,
  effectiveViewportWidth,
  msPerBeat,
  pixelsPerBeat,
  playheadMs,
  isPlaying,
  followPlayhead,
  pianoRollScroll,
  setPianoRollScroll,
  setPianoRollFollow,
  fallbackViewportWidth,
}: UsePianoRollScrollSyncProps): UsePianoRollScrollSyncReturn => {
  const restoredScrollRef = useRef(false);
  const lastProgrammaticScrollTimeRef = useRef(0);
  const autoScrollRafRef = useRef<number | null>(null);
  const [gridViewportWidth, setGridViewportWidth] = useState(fallbackViewportWidth);
  const [gridExtraBeats, setGridExtraBeats] = useState(0);

  // Compute base grid width (without extra beats) to determine when to expand
  // This breaks the circular dependency with usePianoRollDerivedState
  const baseGridWidth = useMemo(() => {
    const clipTotalBeats =
      activeTrackClips.length === 0
        ? 8
        : Math.max(
            activeTrackClips.reduce((max, clip) => {
              const clipEndBeats = (clip.start + clip.duration) / msPerBeat;
              return Math.max(max, clipEndBeats);
            }, 0),
            8,
          );

    const playheadBeats = playheadMs / msPerBeat;
    const playheadBufferBeats = 16;
    const beatsForViewport = Math.max(
      8,
      clipTotalBeats + EXTRA_BEATS,
      Math.ceil(playheadBeats + playheadBufferBeats),
    );

    return Math.max(beatsForViewport * pixelsPerBeat, PIANO_ROLL.MIN_GRID_WIDTH);
  }, [activeTrackClips, msPerBeat, pixelsPerBeat, playheadMs]);

  // Current grid width includes extra beats
  const gridWidth = baseGridWidth + gridExtraBeats * pixelsPerBeat;

  // Measure piano keys width and calculate viewport width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const computeWidths = () => {
      const containerWidth = container.clientWidth;
      const keysNode = pianoKeysRef.current;
      const measuredKeysWidth = keysNode
        ? Math.round(keysNode.getBoundingClientRect().width)
        : PIANO_KEYS_WIDTH_FALLBACK;
      pianoKeysWidthRef.current = measuredKeysWidth || PIANO_KEYS_WIDTH_FALLBACK;

      const candidate = containerWidth - measuredKeysWidth;
      const nextViewportWidth = candidate > 0 ? candidate : containerWidth;
      setGridViewportWidth(nextViewportWidth);
    };

    computeWidths();

    const resizeObserver = new ResizeObserver(computeWidths);
    resizeObserver.observe(container);
    const keysNode = pianoKeysRef.current;
    if (keysNode) {
      resizeObserver.observe(keysNode);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef, pianoKeysRef, pianoKeysWidthRef]);

  // Dynamically expand grid as user scrolls right
  useEffect(() => {
    if (effectiveViewportWidth <= 0) return;
    const remaining = gridWidth - (scrollLeft + effectiveViewportWidth);
    if (remaining < effectiveViewportWidth) {
      setGridExtraBeats((prev) => prev + EXTRA_BEATS);
    }
  }, [scrollLeft, effectiveViewportWidth, gridWidth]);

  // Restore scroll position on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container || restoredScrollRef.current) return;

    container.scrollLeft = pianoRollScroll.left;
    container.scrollTop = pianoRollScroll.top;
    lastProgrammaticScrollTimeRef.current = performance.now();
    restoredScrollRef.current = true;
  }, [containerRef, pianoRollScroll.left, pianoRollScroll.top]);

  // Sync scroll position to store
  useEffect(() => {
    const prev = useUIStore.getState().pianoRollScroll;
    if (prev.left === scrollLeft && prev.top === scrollTop) {
      return;
    }
    setPianoRollScroll({ left: scrollLeft, top: scrollTop });
  }, [scrollLeft, scrollTop, setPianoRollScroll]);

  // Disable follow mode on manual scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const now = performance.now();
      const timeSinceProgrammatic = now - lastProgrammaticScrollTimeRef.current;
      // Ignore scroll events that happen within 120ms of programmatic scroll
      if (timeSinceProgrammatic < 120) {
        return;
      }

      const { isPlaying: currentlyPlaying } = useTransportStore.getState();
      const { pianoRollFollowPlayhead: currentlyFollowing } = useUIStore.getState();

      if (currentlyPlaying && currentlyFollowing) {
        setPianoRollFollow(false);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, setPianoRollFollow]);

  // Auto-scroll during playback when follow is enabled
  // Keeps playhead locked at 70% of viewport width during playback
  useEffect(() => {
    if (!isPlaying || !followPlayhead) return;
    const container = containerRef.current;
    if (!container || effectiveViewportWidth <= 0) return;

    const followRatio = 0.7;
    const maxScrollLeft = Math.max(0, gridWidth - effectiveViewportWidth);

    const animate = () => {
      const { playheadMs, isPlaying: currentlyPlaying } = useTransportStore.getState();
      const { pianoRollFollowPlayhead: currentlyFollowing } = useUIStore.getState();

      if (!currentlyPlaying || !currentlyFollowing) {
        autoScrollRafRef.current = null;
        return;
      }

      const playheadBeatsLatest = playheadMs / msPerBeat;
      const playheadXLatest = playheadBeatsLatest * pixelsPerBeat;
      const desiredScrollLeft = Math.min(
        Math.max(playheadXLatest - effectiveViewportWidth * followRatio, 0),
        maxScrollLeft,
      );

      if (Math.abs(desiredScrollLeft - container.scrollLeft) > 0.5) {
        container.scrollLeft = desiredScrollLeft;
        lastProgrammaticScrollTimeRef.current = performance.now();
      }

      autoScrollRafRef.current = requestAnimationFrame(animate);
    };

    autoScrollRafRef.current = requestAnimationFrame(animate);

    return () => {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, [
    isPlaying,
    followPlayhead,
    gridWidth,
    effectiveViewportWidth,
    msPerBeat,
    pixelsPerBeat,
    containerRef,
  ]);

  return {
    gridViewportWidth,
    gridExtraBeats,
    setGridExtraBeats,
  };
};
