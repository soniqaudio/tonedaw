"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTrackStore } from "@/core/stores/useTrackStore";
import { usePatternStore } from "@/core/stores/usePatternStore";
import { usePlaylistStore } from "@/core/stores/usePlaylistStore";
import { useViewStore } from "@/core/stores/useViewStore";
import { getOrCreateTrackForPattern, calculatePatternLength } from "@/core/utils/patternUtils";

const TOTAL_BARS = 16;
const BAR_WIDTH = 112;
const ROW_HEIGHT = 64;

const timelineWidth = TOTAL_BARS * BAR_WIDTH;

// Darker blue gradient for patterns
const patternGradient = "linear-gradient(135deg, hsl(217, 91%, 40%) 0%, hsl(217, 91%, 30%) 50%, hsl(217, 91%, 20%) 100%)";

export function PlaylistView() {
  const tracks = useTrackStore((state) => state.tracks);
  const patterns = usePatternStore((state) => state.patterns);
  const createPattern = usePatternStore((state) => state.actions.createPattern);
  const playlistClips = usePlaylistStore((state) => state.clips);
  const getClipsByTrack = usePlaylistStore((state) => state.actions.getClipsByTrack);
  const [isCreatingPattern, setIsCreatingPattern] = useState(false);
  const [newPatternName, setNewPatternName] = useState("");

  // Initialize default Pattern 1 with playlist clip if needed
  useEffect(() => {
    const { patterns, actions: patternActions } = usePatternStore.getState();
    const { clips, actions: playlistActions } = usePlaylistStore.getState();
    const { tracks } = useTrackStore.getState();
    
    // Ensure Pattern 1 exists and has a playlist clip
    const pattern1 = patterns.find((p) => p.id === "pattern-default-1");
    if (pattern1 && tracks.length > 0) {
      const track1 = tracks[0];
      const pattern1Clip = clips.find((c) => c.patternId === pattern1.id);
      
      if (!pattern1Clip && track1) {
        // Create playlist clip for Pattern 1
        playlistActions.addClip({
          patternId: pattern1.id,
          trackId: track1.id,
          start: 0,
          length: 1,
          label: pattern1.name,
          type: "Pattern",
        });
        // Set Pattern 1 as editing
        patternActions.setEditingPattern(pattern1.id);
      }
    }
  }, []);

  const handleCreatePattern = () => {
    if (!newPatternName.trim()) return;
    
    const patternName = newPatternName.trim();
    
    // FL Studio-style: Create pattern on new track
    const trackId = getOrCreateTrackForPattern();
    const patternId = createPattern(patternName, trackId);
    
    // Create a playlist clip for this pattern
    const { addClip } = usePlaylistStore.getState().actions;
    const patternLength = calculatePatternLength(patternId);
    
    addClip({
      patternId,
      trackId, // New track for each pattern
      start: 0, // Always at bar 0 on new track
      length: patternLength, // Dynamic length
      label: patternName,
      type: "Pattern",
    });
    
    setNewPatternName("");
    setIsCreatingPattern(false);
  };

  // Sort patterns by track order (to maintain visual order)
  const sortedPatterns = [...patterns].sort((a, b) => {
    const trackAIndex = tracks.findIndex((t) => t.id === a.trackId);
    const trackBIndex = tracks.findIndex((t) => t.id === b.trackId);
    if (trackAIndex !== trackBIndex) {
      return trackAIndex - trackBIndex;
    }
    return a.createdAt - b.createdAt;
  });

  return (
    <div className="flex h-full w-full flex-col bg-base text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Track List */}
        <div className="w-52 border-r border-border bg-layer-1">
          {/* Spacer to align with timeline */}
          <div className="h-8 border-b border-subtle" />
          {tracks.length === 0 ? (
            <div className="flex items-center justify-center border-b border-subtle px-4 py-8" style={{ height: `${ROW_HEIGHT}px` }}>
              <p className="text-sm text-tertiary">No tracks</p>
            </div>
          ) : (
            <>
              {/* Show all patterns in a flat list */}
              {sortedPatterns.map((pattern) => {
                const track = tracks.find((t) => t.id === pattern.trackId);
                return (
                  <div
                    key={pattern.id}
                    className="flex items-center justify-between border-b border-subtle px-4 pl-8"
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[12px] font-medium text-foreground">{pattern.name}</p>
                      <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-disabled">
                        PATTERN
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {/* Single "+" button below last pattern */}
              <div className="border-b border-subtle px-4 pl-8" style={{ height: `${ROW_HEIGHT}px` }}>
                {isCreatingPattern ? (
                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="text"
                      value={newPatternName}
                      onChange={(e) => setNewPatternName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreatePattern();
                        } else if (e.key === "Escape") {
                          setIsCreatingPattern(false);
                          setNewPatternName("");
                        }
                      }}
                      placeholder="Pattern name..."
                      className="h-7 flex-1 rounded-sm border border-subtle bg-layer-1 px-2 text-xs text-foreground placeholder:text-tertiary focus:border-primary focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreatePattern}
                      className="h-7 rounded-sm border border-primary bg-primary px-2 text-xs font-medium text-white hover:bg-primary/90"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCreatingPattern(true)}
                    className="flex h-full w-full items-center px-2 text-xs font-medium text-tertiary hover:text-foreground"
                  >
                    + New Pattern
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Timeline Area */}
        <div className="relative flex-1 overflow-auto bg-base">
          {/* Timeline Header */}
          <div
            className="sticky top-0 z-20 flex border-b border-medium bg-layer-2 shadow-layer-sm"
            style={{ width: timelineWidth }}
          >
            {Array.from({ length: TOTAL_BARS }, (_, index) => {
              const isBarStart = (index + 1) % 4 === 1;
              return (
                <div
                  key={index}
                  className={cn(
                    "relative flex h-8 w-[112px] items-center justify-center text-[10px] font-semibold",
                    isBarStart ? "border-r border-medium text-secondary" : "border-r border-subtle text-tertiary"
                  )}
                >
                  <span>{index + 1}</span>
                </div>
              );
            })}
          </div>

          {/* Grid and Clips */}
          <div className="relative" style={{ width: timelineWidth }}>
            {/* Vertical grid lines */}
            {Array.from({ length: TOTAL_BARS }, (_, index) => {
              const isBarStart = (index + 1) % 4 === 1;
              return (
                <div
                  key={`grid-${index}`}
                  className={cn(
                    "absolute top-0 bottom-0 pointer-events-none",
                    isBarStart ? "border-r border-medium" : "border-r border-subtle"
                  )}
                  style={{ left: index * BAR_WIDTH }}
                />
              );
            })}

            {tracks.map((track) => {
              const trackClips = getClipsByTrack(track.id);
              return (
                <div
                  key={track.id}
                  className="relative border-b border-subtle"
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  {trackClips.map((clip) => {
                    const clipWidth = Math.max(clip.length * BAR_WIDTH - 8, 64);
                    const isPattern = clip.type === "Pattern";
                    const isAudio = clip.type === "Audio";

                    return (
                      <div
                        key={clip.id}
                        className={cn(
                          "absolute rounded-md border px-3 py-2 text-sm font-semibold shadow-layer-md transition-all hover:shadow-layer-lg flex flex-col cursor-pointer",
                          isPattern && "border-transparent",
                          isAudio && "border-subtle"
                        )}
                        style={{
                          left: clip.start * BAR_WIDTH + 4,
                          top: "8px",
                          height: `${ROW_HEIGHT - 16}px`,
                          width: clipWidth,
                          background: isPattern
                            ? patternGradient
                            : isAudio
                              ? "linear-gradient(135deg, hsl(0, 0%, 18%) 0%, hsl(0, 0%, 14%) 100%)"
                              : "linear-gradient(135deg, hsl(0, 0%, 16%) 0%, hsl(0, 0%, 12%) 100%)",
                        }}
                        onDoubleClick={() => {
                          // TODO: Open pattern editor if it's a pattern clip
                          if (clip.patternId) {
                            usePatternStore.getState().actions.setEditingPattern(clip.patternId);
                            useViewStore.getState().actions.setActiveView("piano-roll");
                          }
                        }}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn(isPattern ? "text-white" : "text-secondary")}>
                            {clip.label}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] uppercase tracking-[0.3em]",
                              isPattern ? "text-primary/80" : "text-tertiary"
                            )}
                          >
                            {isPattern ? "PAT" : "AUDIO"}
                          </span>
                        </div>
                        {isAudio && (
                          <div className="mt-1 flex-1 overflow-hidden rounded-sm bg-black/20">
                            <svg viewBox="0 0 120 32" className="h-full w-full opacity-60" role="img">
                              <title>{clip.label} waveform mock</title>
                              <polyline
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                points="0,16 8,8 16,20 24,6 32,22 40,4 48,26 56,10 64,24 72,8 80,18 88,12 96,20 104,14 112,16 120,15"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
