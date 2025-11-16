"use client";

import { useMemo, useRef } from "react";
import type { MidiNoteClip } from "@/core/midi/types";
import { useTrackStore } from "@/core/stores/useTrackStore";

interface VelocityLaneProps {
  width: number;
  height: number;
  clips: MidiNoteClip[];
  scrollLeft: number;
  pixelsPerBeat: number;
  msPerBeat: number;
  selectedClipIds: string[];
  onVelocityChange: (clipIds: string[], velocity: number) => void;
  isOpen?: boolean;
  subdivisionsPerBeat?: number;
}

const DEFAULT_VELOCITY = 100; // MIDI 0-127 range

export const VelocityLane = ({
  width,
  height,
  clips,
  scrollLeft,
  pixelsPerBeat,
  msPerBeat,
  selectedClipIds,
  onVelocityChange,
  isOpen,
  subdivisionsPerBeat = 4,
}: VelocityLaneProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tracks = useTrackStore((state) => state.tracks);
  const viewWidth = Math.max(1, width);
  const laneOpen = isOpen !== false;

  const trackColorMap = useMemo(() => {
    const map = new Map<string, string>();
    tracks.forEach((track) => {
      map.set(track.id, track.color);
    });
    return map;
  }, [tracks]);

  const selectedSet = useMemo(() => new Set(selectedClipIds), [selectedClipIds]);

  const bars = useMemo(() => {
    if (!laneOpen)
      return [] as Array<{ clip: MidiNoteClip; x: number; barWidth: number; velocity: number }>;

    return clips.map((clip) => {
      const startBeats = clip.start / msPerBeat;
      const x = startBeats * pixelsPerBeat - scrollLeft;
      const durationBeats = clip.duration / msPerBeat;
      const barWidth = Math.max(6, Math.min(12, durationBeats * pixelsPerBeat * 0.6));
      // Normalize velocity to 0-1 for display (our internal format is 0-127)
      const rawVelocity = clip.velocity ?? DEFAULT_VELOCITY;
      const velocity = rawVelocity <= 1 ? rawVelocity : rawVelocity / 127;
      return { clip, x, barWidth, velocity };
    });
  }, [clips, laneOpen, msPerBeat, pixelsPerBeat, scrollLeft]);

  const handlePointerDown = (clipId: string, event: React.PointerEvent<SVGRectElement>) => {
    event.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    svg.setPointerCapture(event.pointerId);

    const targetIds =
      selectedSet.has(clipId) && selectedClipIds.length > 0 ? selectedClipIds : [clipId];

    const updateVelocityFromClientY = (clientY: number) => {
      const rect = svg.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      const normalized = 1 - relativeY / height;
      const clamped = Math.max(0, Math.min(1, normalized));
      // Convert from 0-1 to 0-127 MIDI range
      const velocity = Math.round(clamped * 127);
      onVelocityChange(targetIds, velocity);
    };

    updateVelocityFromClientY(event.clientY);

    const handleMove = (moveEvent: PointerEvent) => {
      updateVelocityFromClientY(moveEvent.clientY);
    };

    const handleUp = (upEvent: PointerEvent) => {
      updateVelocityFromClientY(upEvent.clientY);
      svg.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleDoubleClick = (clipId: string, event: React.MouseEvent) => {
    event.preventDefault();
    const targetIds =
      selectedSet.has(clipId) && selectedClipIds.length > 0 ? selectedClipIds : [clipId];
    onVelocityChange(targetIds, DEFAULT_VELOCITY);
  };

  const viewportBeats = viewWidth / pixelsPerBeat;
  const firstBeat = Math.floor(scrollLeft / pixelsPerBeat) - 1;
  const beatsInView = Math.ceil(viewportBeats) + 3;
  const horizontalLines = [0.25, 0.5, 0.75];

  // Calculate bar backgrounds (every 4 beats)
  const beatsPerMeasure = 4;
  const firstBlock = Math.floor(scrollLeft / (pixelsPerBeat * beatsPerMeasure));
  const blocksInView = Math.ceil(viewWidth / (pixelsPerBeat * beatsPerMeasure)) + 2;

  return (
    <div className="relative w-full overflow-hidden bg-[#111115] border-t border-white/10" style={{ height }}>
      {laneOpen && (
        <div className="absolute inset-0 overflow-hidden">
          <svg
            aria-hidden="true"
            ref={svgRef}
            width={viewWidth}
            height={height}
            className="absolute inset-0"
          >
            {/* Alternating bar backgrounds - matching piano roll */}
            {Array.from({ length: blocksInView }).map((_, idx) => {
              const block = firstBlock + idx;
              const blockStartBeat = block * beatsPerMeasure;
              const blockStartX = blockStartBeat * pixelsPerBeat - scrollLeft;
              const blockWidth = beatsPerMeasure * pixelsPerBeat;
              const isLight = block % 2 === 0;
              return (
                <rect
                  key={`block-${block}`}
                  x={blockStartX}
                  y={0}
                  width={blockWidth}
                  height={height}
                  fill={isLight ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.04)"}
                />
              );
            })}

            {/* Horizontal reference lines */}
            {horizontalLines.map((line, index) => {
              const y = height * (1 - line);
              return (
                <line
                  key={`h-${index}`}
                  x1={0}
                  y1={y}
                  x2={viewWidth}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                  strokeDasharray="2,4"
                />
              );
            })}

            {/* Vertical beat lines - matching piano roll */}
            {Array.from({ length: beatsInView }).map((_, idx) => {
              const beat = firstBeat + idx;
              if (beat < 0) return null;
              const x = beat * pixelsPerBeat - scrollLeft;
              if (x < -1 || x > viewWidth + 1) return null;
              const isMeasure = beat % beatsPerMeasure === 0;
              return (
                <line
                  key={`beat-${beat}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={height}
                  stroke={isMeasure ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)"}
                  strokeWidth={1}
                />
              );
            })}

            {/* Subdivision lines (gray lines between beats) */}
            {Array.from({ length: beatsInView * subdivisionsPerBeat }).map((_, idx) => {
              const subdivision = (firstBeat * subdivisionsPerBeat) + idx;
              if (subdivision < 0) return null;
              // Skip if this is a beat line (already drawn above)
              if (subdivision % subdivisionsPerBeat === 0) return null;

              const x = (subdivision / subdivisionsPerBeat) * pixelsPerBeat - scrollLeft;
              if (x < -1 || x > viewWidth + 1) return null;

              return (
                <line
                  key={`subdiv-${subdivision}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={height}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth={1}
                />
              );
            })}
            {/* Velocity bars */}
            {bars.map(({ clip, x, barWidth, velocity }) => {
              if (x + barWidth < -12 || x > viewWidth + 12) return null;
              const barHeight = velocity * (height - 16);
              const barY = height - barHeight - 8;
              const color = trackColorMap.get(clip.trackId) || "#3b82f6";
              const isSelected = selectedSet.has(clip.id);
              const handleWidth = 6;
              const handleHeight = Math.max(barHeight, 4);

              return (
                <g key={clip.id} transform={`translate(${x},0)`}>
                  {/* Stem line */}
                  <line
                    x1={barWidth / 2}
                    y1={height - 8}
                    x2={barWidth / 2}
                    y2={barY}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.5}
                    strokeOpacity={isSelected ? 0.7 : 0.5}
                    strokeLinecap="round"
                  />
                  {/* Draggable handle */}
                  <rect
                    role="presentation"
                    x={barWidth / 2 - handleWidth / 2}
                    y={barY}
                    width={handleWidth}
                    height={handleHeight}
                    rx={3}
                    fill={color}
                    fillOpacity={isSelected ? 1 : 0.8}
                    stroke={isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)"}
                    strokeWidth={isSelected ? 1.5 : 1}
                    onPointerDown={(event) => handlePointerDown(clip.id, event)}
                    onDoubleClick={(event) => handleDoubleClick(clip.id, event)}
                    style={{ cursor: "ns-resize" }}
                    className="transition-opacity hover:opacity-100"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
