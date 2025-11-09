"use client";

import { useCallback, useMemo, useRef } from "react";
import { playbackController } from "@/core/playback/playbackController";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { useMusicTheoryStore } from "@/core/stores/useMusicTheoryStore";
import { useTrackStore } from "@/core/stores/useTrackStore";
import { useTransportStore } from "@/core/stores/useTransportStore";
import { useUIStore } from "@/core/stores/useUIStore";
import { resolveTrackId } from "@/core/utils/trackUtils";
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

  const activeTrackId = useTrackStore((state) => state.activeTrackId);
  const setActiveTrack = useTrackStore((state) => state.actions.setActiveTrack);

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
  const basePixelsPerBeat = 64; // PIANO_ROLL.PIXELS_PER_BEAT
  const baseKeyHeight = 16; // PIANO_ROLL.KEY_HEIGHT

  // Canvas sizing
  const {
    width: fallbackViewportWidth,
    height: canvasHeight,
    scrollLeft,
    scrollTop,
    containerRef,
  } = useCanvasSize(baseKeyHeight, 88); // 88 piano keys

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
    pixelsPerBeat: basePixelsPerBeat,
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
    recordingPreviewClips,
    liveEvents,
    tempo,
    playheadMs,
    gridExtraBeats,
    gridResolutionId,
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
            <PianoKeys pianoKeys={pianoKeys} keyHeight={keyHeight} activeNotes={activeNotes} />
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
          className="pointer-events-auto absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 transition-fast hover:text-primary"
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
              <path d="M3 7l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
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
