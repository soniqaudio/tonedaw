"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { playbackController } from "@/core/playback/playbackController";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { useMusicTheoryStore } from "@/core/stores/useMusicTheoryStore";
import { usePatternStore } from "@/core/stores/usePatternStore";
import { useTrackStore } from "@/core/stores/useTrackStore";
import { useTransportStore } from "@/core/stores/useTransportStore";
import { useUIStore } from "@/core/stores/useUIStore";
import { resolveTrackId } from "@/core/utils/trackUtils";
import { PIANO_ROLL } from "@/core/constants/pianoRoll";
import { useCanvasSize } from "./piano-roll/hooks/useCanvasSize";
import { usePianoRollDerivedState } from "./piano-roll/hooks/usePianoRollDerivedState";
import { usePianoRollInteractions } from "./piano-roll/hooks/usePianoRollInteractions";
import { usePianoRollKeyboardShortcuts } from "./piano-roll/hooks/usePianoRollKeyboardShortcuts";
import { usePianoRollScrollSync } from "./piano-roll/hooks/usePianoRollScrollSync";
import { DynamicOverlay, GhostNotesLayer, NotesLayer, StaticGrid } from "./piano-roll/layers";
import { PianoKeys } from "./piano-roll/PianoKeys";
import { Timeline } from "./piano-roll/Timeline";
import { VelocityLane } from "./piano-roll/VelocityLane";

const VELOCITY_LANE_HEIGHT = 120;
const PIANO_KEYS_WIDTH_FALLBACK = 80;

const PianoRoll = () => {
  // Store selectors
  const sustainExtendedClips = useMidiStore((state) => state.clips);
  const clipsWithoutSustain = useMidiStore((state) => state.clipsWithoutSustain);
  const addClip = useMidiStore((state) => state.actions.addClip);
  const removeClip = useMidiStore((state) => state.actions.removeClip);
  const updateClipDuration = useMidiStore((state) => state.actions.updateClipDuration);
  const updateClips = useMidiStore((state) => state.actions.updateClips);
  const setSelectedClipIds = useMidiStore((state) => state.actions.setSelectedClipIds);
  const selectedClipIds = useMidiStore((state) => state.selectedClipIds);
  const liveEvents = useMidiStore((state) => state.liveEvents);
  const recordingPreviewClips = useMidiStore((state) => state.recordingPreviewClips);
  const updateClipVelocity = useMidiStore((state) => state.actions.updateClipVelocity);

  const tempo = useMusicTheoryStore((state) => state.tempo);
  const playheadMs = useTransportStore((state) => state.playheadMs);
  const isPlaying = useTransportStore((state) => state.isPlaying);
  const setPlayheadMs = useTransportStore((state) => state.actions.setPlayheadMs);

  const pianoRollScroll = useUIStore((state) => state.pianoRollScroll);
  const followPlayhead = useUIStore((state) => state.pianoRollFollowPlayhead);
  const showGhostNotes = useUIStore((state) => state.showGhostNotes);
  const showSustainExtended = useUIStore((state) => state.showSustainExtended);
  const showVelocityLane = useUIStore((state) => state.showVelocityLane);
  const setPianoRollScroll = useUIStore((state) => state.actions.setPianoRollScroll);
  const setPianoRollFollow = useUIStore((state) => state.actions.setPianoRollFollow);
  const toggleVelocityLane = useUIStore((state) => state.actions.toggleVelocityLane);
  const gridResolutionId = useUIStore((state) => state.pianoRollGridResolution);
  const pianoRollZoom = useUIStore((state) => state.pianoRollZoom);
  const pianoRollKeyHeight = useUIStore((state) => state.pianoRollKeyHeight);
  const setPianoRollZoom = useUIStore((state) => state.actions.setPianoRollZoom);

  const activeTrackId = useTrackStore((state) => state.activeTrackId);
  const setActiveTrack = useTrackStore((state) => state.actions.setActiveTrack);
  const editingPatternId = usePatternStore((state) => state.editingPatternId);

  // Refs
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const pianoKeysRef = useRef<HTMLDivElement>(null);
  const pianoKeysWidthRef = useRef(PIANO_KEYS_WIDTH_FALLBACK);

  // Compute activeTrackClips inline for scroll sync hook (avoids calling derived state twice)
  // This breaks the circular dependency: gridWidth needs gridExtraBeats, but gridExtraBeats needs gridWidth
  const allClips = showSustainExtended ? sustainExtendedClips : clipsWithoutSustain;
  const baseActiveTrackClips = useMemo(() => {
    if (!activeTrackId) return allClips;
    const resolvedActiveId = resolveTrackId(activeTrackId);
    return allClips.filter((clip) => resolveTrackId(clip.trackId) === resolvedActiveId);
  }, [allClips, activeTrackId]);

  // Compute base timing values needed for scroll sync (without calling full derived state)
  const baseMsPerBeat = 60000 / Math.max(tempo, 1);
  const zoomedPixelsPerBeat = PIANO_ROLL.PIXELS_PER_BEAT * pianoRollZoom;
  const zoomedKeyHeight = PIANO_ROLL.KEY_HEIGHT * pianoRollKeyHeight;

  // Canvas sizing
  const {
    width: fallbackViewportWidth,
    height: canvasHeight,
    scrollLeft,
    scrollTop,
    containerRef,
  } = useCanvasSize(zoomedKeyHeight, 88); // 88 piano keys

  // Scroll synchronization hook - computes gridExtraBeats internally using base grid width
  const { gridViewportWidth, gridExtraBeats } = usePianoRollScrollSync({
    containerRef,
    pianoKeysRef,
    pianoKeysWidthRef,
    scrollLeft,
    scrollTop,
    activeTrackClips: baseActiveTrackClips,
    effectiveViewportWidth: fallbackViewportWidth,
    msPerBeat: baseMsPerBeat,
    pixelsPerBeat: zoomedPixelsPerBeat,
    playheadMs,
    isPlaying,
    followPlayhead,
    pianoRollScroll,
    setPianoRollScroll,
    setPianoRollFollow,
    fallbackViewportWidth,
  });

  // Single derived state call with actual gridExtraBeats - this is the source of truth
  const derivedState = usePianoRollDerivedState({
    sustainExtendedClips,
    clipsWithoutSustain,
    showSustainExtended,
    showGhostNotes,
    activeTrackId,
    editingPatternId,
    recordingPreviewClips,
    liveEvents,
    tempo,
    playheadMs,
    gridExtraBeats,
    gridResolutionId,
    pianoRollZoom,
    pianoRollKeyHeight,
  });

  const {
    pianoKeys,
    noteToIndex,
    activeNotes,
    activeTrackClips,
    ghostClips,
    renderClips,
    msPerBeat,
    pixelsPerBeat,
    keyHeight,
    notePadding,
    subdivisionsPerBeat,
    quantizationBeats,
    defaultDurationBeats,
    gridWidth,
  } = derivedState;

  const effectiveViewportWidth = gridViewportWidth > 0 ? gridViewportWidth : fallbackViewportWidth;
  const gridCanvasWidth = Math.max(Math.round(effectiveViewportWidth), 1);

  // Keyboard shortcuts hook
  usePianoRollKeyboardShortcuts({
    msPerBeat,
    quantizationBeats,
    activeTrackClips,
    selectedClipIds,
    setSelectedClipIds,
    updateClips,
  });

  // Interactions hook
  const {
    handleTimelinePointerDown,
    handleViewportDragStart,
    handleGridPointerDown,
    handleGridPointerMove,
    selectionRect,
  } = usePianoRollInteractions({
    pianoKeys,
    clips: activeTrackClips,
    ghostClips,
    addClip,
    removeClip,
    updateClipDuration,
    updateClips,
    setSelectedClipIds,
    selectedClipIds,
    pixelsPerBeat,
    msPerBeat,
    keyHeight,
    quantizationBeats,
    defaultDurationBeats,
    gridWidth: derivedState.gridWidth,
    setPlayheadMs,
    isPlaying,
    pause: () => playbackController.pause(),
    containerRef,
    gridContainerRef,
    timelineContainerRef,
    scrollLeft,
    noteToIndex,
    viewportWidth: effectiveViewportWidth,
    activateTrack: setActiveTrack,
  });

  // Velocity change handler
  const handleVelocityChange = useCallback(
    (clipIds: string[], velocity: number) => {
      updateClipVelocity(clipIds, velocity);
    },
    [updateClipVelocity],
  );

  const velocityRowHeight = showVelocityLane ? VELOCITY_LANE_HEIGHT : 20;

  // Handle wheel events for horizontal zoom (trackpad pinch)
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const isPinchGesture = event.ctrlKey || event.metaKey;
      if (!isPinchGesture) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const container = containerRef.current;
      if (!container) return;

      // Use deltaX for horizontal pinch (trackpad) or deltaY for vertical scroll with modifier
      // Trackpad pinch typically uses deltaY with ctrl/cmd
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : -event.deltaY;

      // Calculate zoom delta (negative delta = zoom in, positive = zoom out)
      const zoomSpeed = 0.5;
      const zoomDelta = delta * zoomSpeed * 0.01;
      const currentZoom = pianoRollZoom;
      const newZoom = Math.max(0.25, Math.min(4.0, currentZoom + zoomDelta));

      if (newZoom === currentZoom) return;

      const rect = container.getBoundingClientRect();
      const currentScrollLeft = container.scrollLeft;
      const gridRect = gridContainerRef.current?.getBoundingClientRect();
      const pianoKeysWidth = pianoKeysWidthRef.current || PIANO_KEYS_WIDTH_FALLBACK;
      const relativeMouseX = gridRect
        ? event.clientX - gridRect.left
        : event.clientX - rect.left - pianoKeysWidth;
      const mouseX = Math.max(0, relativeMouseX);
      const worldX = mouseX + currentScrollLeft;
      const ratio = newZoom / currentZoom;
      const newScrollLeft = Math.max(0, worldX * ratio - mouseX);

      // Apply scroll + zoom together on the next frame to avoid jitter
      requestAnimationFrame(() => {
        if (!container) return;
        container.scrollLeft = newScrollLeft;
        setPianoRollZoom(newZoom);
      });
    },
    [pianoRollZoom, setPianoRollZoom, containerRef],
  );

  // Attach non-passive wheel listener directly to the scroll container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (event: WheelEvent) => {
      handleWheel(event);
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
    };
  }, [containerRef, handleWheel]);

  // Prevent browser zoom when cmd/ctrl pinch gestures occur anywhere over the piano roll
  useEffect(() => {
    const handleGlobalWheel = (event: WheelEvent) => {
      if (event.defaultPrevented) return;
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const insideRect =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!insideRect) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleWheel(event);
    };

    const handleGesture = (event: Event) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const { clientX = 0, clientY = 0 } = event as unknown as { clientX?: number; clientY?: number };
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", handleGlobalWheel, { passive: false });
    window.addEventListener("gesturestart", handleGesture, { passive: false });
    window.addEventListener("gesturechange", handleGesture, { passive: false });
    window.addEventListener("gestureend", handleGesture, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
      window.removeEventListener("gesturestart", handleGesture);
      window.removeEventListener("gesturechange", handleGesture);
      window.removeEventListener("gestureend", handleGesture);
    };
  }, [containerRef, handleWheel]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <Timeline
        ref={timelineContainerRef}
        gridWidth={derivedState.gridWidth}
        pixelsPerBeat={pixelsPerBeat}
        subdivisionsPerBeat={subdivisionsPerBeat}
        scrollLeft={scrollLeft}
        viewportWidth={effectiveViewportWidth}
        playheadX={derivedState.clampedPlayheadX}
        onPointerDown={handleTimelinePointerDown}
        onViewportDragStart={handleViewportDragStart}
      />

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsla(var(--primary-hue),85%,55%,0.07),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,12,0.6)0%,rgba(10,10,12,0.82)45%,rgba(10,10,12,0.9)100%)]" />
        <div
          ref={containerRef}
          className="relative flex flex-1 overflow-auto overscroll-y-contain"
          style={{ cursor: "crosshair" }}
        >
          {/* Piano Keys - sticky horizontally, scrolls vertically with grid */}
          <div ref={pianoKeysRef} className="sticky left-0 z-10 flex-shrink-0">
            <PianoKeys
              pianoKeys={pianoKeys}
              keyHeight={keyHeight}
              activeNotes={activeNotes}
              clips={activeTrackClips}
              playheadMs={playheadMs}
            />
          </div>

          {/* Grid + Velocity lane stack */}
          <div className="relative flex flex-col" style={{ width: derivedState.gridWidth }}>
            <div
              className="relative"
              style={{ width: derivedState.gridWidth, height: canvasHeight }}
            >
              {/* Invisible spacer to create scrollable area */}
              <div
                style={{
                  width: derivedState.gridWidth,
                  height: canvasHeight,
                  position: "absolute",
                }}
              />

              {/* Canvas container - positioned absolutely within scroll area */}
              <div
                role="application"
                tabIndex={-1}
                className="pointer-events-auto absolute left-0 top-0"
                style={{
                  width: derivedState.gridWidth,
                  height: canvasHeight,
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* Viewport-anchored wrapper */}
                <div
                  ref={gridContainerRef}
                  style={{
                    width: gridCanvasWidth,
                    height: canvasHeight,
                    position: "sticky",
                    top: 0,
                    left: pianoKeysWidthRef.current || PIANO_KEYS_WIDTH_FALLBACK,
                    pointerEvents: "auto",
                  }}
                  onPointerDown={handleGridPointerDown}
                  onPointerMove={handleGridPointerMove}
                >
                  <StaticGrid
                    width={gridCanvasWidth}
                    height={canvasHeight}
                    keyHeight={keyHeight}
                    pixelsPerBeat={pixelsPerBeat}
                    scrollLeft={scrollLeft}
                    subdivisionsPerBeat={subdivisionsPerBeat}
                    pianoKeys={pianoKeys}
                  />
                  {showGhostNotes && ghostClips.length > 0 && (
                    <GhostNotesLayer
                      width={gridCanvasWidth}
                      height={canvasHeight}
                      ghostClips={ghostClips}
                      noteToIndex={noteToIndex}
                      msPerBeat={msPerBeat}
                      pixelsPerBeat={pixelsPerBeat}
                      keyHeight={keyHeight}
                      notePadding={notePadding}
                      scrollLeft={scrollLeft}
                      viewportWidth={effectiveViewportWidth}
                    />
                  )}
                  <NotesLayer
                    width={gridCanvasWidth}
                    height={canvasHeight}
                    clips={renderClips}
                    noteToIndex={noteToIndex}
                    msPerBeat={msPerBeat}
                    pixelsPerBeat={pixelsPerBeat}
                    keyHeight={keyHeight}
                    notePadding={notePadding}
                    scrollLeft={scrollLeft}
                    viewportWidth={effectiveViewportWidth}
                  />
                  <DynamicOverlay
                    width={gridCanvasWidth}
                    height={canvasHeight}
                    playheadX={derivedState.playheadX}
                    activeNotes={activeNotes}
                    clips={renderClips}
                    noteToIndex={noteToIndex}
                    msPerBeat={msPerBeat}
                    pixelsPerBeat={pixelsPerBeat}
                    keyHeight={keyHeight}
                    notePadding={notePadding}
                    scrollLeft={scrollLeft}
                    viewportWidth={effectiveViewportWidth}
                    selectionRect={selectionRect}
                    selectedClipIds={selectedClipIds}
                    playheadMs={playheadMs}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-transparent" style={{ height: velocityRowHeight }}>
        <button
          type="button"
          onClick={toggleVelocityLane}
          className={`pointer-events-auto absolute left-3 z-10 flex items-center gap-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 transition-fast hover:text-primary ${
            showVelocityLane ? 'top-2' : 'top-1/2 -translate-y-1/2'
          }`}
        >
          <span>Velocity</span>
          <svg
            aria-hidden="true"
            className="h-2.5 w-2.5 text-muted-foreground/70"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            {showVelocityLane ? (
              <path d="M7 3l-3 3-3-3" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M3 5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
        {showVelocityLane && (
          <div
            className="flex h-full items-stretch"
            style={{ marginLeft: pianoKeysWidthRef.current || PIANO_KEYS_WIDTH_FALLBACK }}
          >
            <div className="flex-1 overflow-hidden">
              <div style={{ width: gridCanvasWidth }}>
                <VelocityLane
                  width={gridCanvasWidth}
                  height={VELOCITY_LANE_HEIGHT}
                  clips={activeTrackClips}
                  scrollLeft={scrollLeft}
                  pixelsPerBeat={pixelsPerBeat}
                  msPerBeat={msPerBeat}
                  selectedClipIds={selectedClipIds}
                  onVelocityChange={handleVelocityChange}
                  subdivisionsPerBeat={subdivisionsPerBeat}
                  isOpen
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PianoRoll;
