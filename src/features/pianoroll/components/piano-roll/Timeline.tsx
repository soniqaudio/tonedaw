"use client";

import {
  forwardRef,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { prepareCanvas } from "./lib/canvas";

interface TimelineProps {
  gridWidth: number;
  pixelsPerBeat: number;
  scrollLeft: number;
  viewportWidth: number;
  playheadX: number;
  subdivisionsPerBeat: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onViewportDragStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(
  (
    {
      gridWidth,
      pixelsPerBeat,
      scrollLeft,
      viewportWidth,
      playheadX,
      subdivisionsPerBeat,
      onPointerDown,
      onViewportDragStart,
    },
    ref,
  ) => {
    const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);

    useEffect(() => {
      const timeline = (ref as React.RefObject<HTMLDivElement>)?.current;
      if (!timeline) return;

      const updateWidth = () => {
        setTimelineViewportWidth(timeline.clientWidth);
      };

      updateWidth();

      const resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(timeline);

      return () => {
        resizeObserver.disconnect();
      };
    }, [ref]);

    const containerWidth = Math.max(timelineViewportWidth || viewportWidth || 1, 1);
    const playheadPosition = Math.max(0, Math.min(containerWidth, playheadX - scrollLeft));
    const totalWidth = Math.max(gridWidth, containerWidth);
    const rawHighlightLeft = totalWidth > 0 ? (scrollLeft / totalWidth) * containerWidth : 0;
    const rawHighlightWidth =
      totalWidth > 0 ? (viewportWidth / totalWidth) * containerWidth : containerWidth;
    const viewportHighlightWidth = Math.max(24, Math.min(containerWidth, rawHighlightWidth));
    const viewportHighlightLeft = Math.min(
      containerWidth - viewportHighlightWidth,
      Math.max(0, rawHighlightLeft),
    );

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const beatsPerBar = 4; // TODO: support other signatures
    const barWidthPx = Math.max(pixelsPerBeat * beatsPerBar, 1);
    const timelineHeight = 32; // px (matches h-8)

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = prepareCanvas(canvas, containerWidth, timelineHeight, { alpha: false });
      ctx.clearRect(0, 0, containerWidth, timelineHeight);

      // Fill base background
      ctx.fillStyle = "#0b0b0d";
      ctx.fillRect(0, 0, containerWidth, timelineHeight);

      // Bar shading
      const firstBar = Math.max(0, Math.floor(scrollLeft / barWidthPx) - 1);
      const barsInView = Math.ceil(containerWidth / barWidthPx) + 2;
      for (let bar = firstBar; bar < firstBar + barsInView; bar++) {
        const barLeft = bar * barWidthPx - scrollLeft;
        const isEven = bar % 2 === 0;
        ctx.fillStyle = isEven ? "rgba(255,255,255,0.028)" : "rgba(0,0,0,0.06)";
        ctx.fillRect(barLeft, 0, barWidthPx, timelineHeight);

        if (bar >= 0 && barWidthPx >= 48) {
          ctx.fillStyle = "rgba(255,255,255,0.68)";
          ctx.font = "600 12px 'Inter', sans-serif";
          ctx.textBaseline = "top";
          ctx.fillText(String(bar + 1), barLeft + 8, 6);
        }
      }

      // Beat lines
      const firstBeat = Math.floor(scrollLeft / pixelsPerBeat) - 1;
      const beatsInView = Math.ceil(containerWidth / pixelsPerBeat) + 4;
      for (let beat = firstBeat; beat < firstBeat + beatsInView; beat++) {
        const x = beat * pixelsPerBeat - scrollLeft;
        if (x < -1 || x > containerWidth + 1) continue;
        const isBarLine = beat % beatsPerBar === 0;
        ctx.strokeStyle = isBarLine ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, timelineHeight);
        ctx.stroke();

        const stepsPerBeat = Math.max(1, Math.round(subdivisionsPerBeat));
        const stepWidth = pixelsPerBeat / stepsPerBeat;
        if (!isBarLine && stepsPerBeat > 1 && stepWidth >= 6) {
          for (let sub = 1; sub < stepsPerBeat; sub++) {
            const subX = x + sub * stepWidth;
            if (subX < -1 || subX > containerWidth + 1) continue;
            const strength = sub % stepsPerBeat === 0 ? 0.12 : 0.06;
            ctx.strokeStyle = `rgba(255,255,255,${strength})`;
            ctx.beginPath();
            ctx.moveTo(Math.round(subX) + 0.5, 12);
            ctx.lineTo(Math.round(subX) + 0.5, timelineHeight);
            ctx.stroke();
          }
        }
      }

      // Cleanup: Clear canvas and release memory when component unmounts
      return () => {
        const cleanupCanvas = canvasRef.current;
        if (!cleanupCanvas) return;

        const cleanupCtx = cleanupCanvas.getContext("2d");
        if (cleanupCtx) {
          // Clear the canvas
          cleanupCtx.clearRect(0, 0, cleanupCanvas.width, cleanupCanvas.height);
          // Reset canvas dimensions to release memory buffers
          cleanupCanvas.width = 0;
          cleanupCanvas.height = 0;
        }
      };
    }, [containerWidth, scrollLeft, pixelsPerBeat, barWidthPx, subdivisionsPerBeat]);

    return (
      <div className="flex bg-surface">
        {/* Keys Header */}
        <div className="flex h-8 w-20 items-center justify-center border-b border-r border-border bg-muted">
          <span className="text-xs font-medium text-muted-foreground">KEYS</span>
        </div>

        {/* Timeline Header */}
        <div
          ref={ref}
          className="relative h-8 flex-1 cursor-ew-resize select-none overflow-hidden border-b border-border bg-muted"
          onPointerDown={onPointerDown}
        >
          <div className="absolute inset-0" aria-hidden="true">
            <div
              className={`absolute top-[2px] bottom-[2px] rounded-sm bg-transparent ${
                onViewportDragStart ? "cursor-grab" : "pointer-events-none"
              }`}
              style={{
                left: `${viewportHighlightLeft}px`,
                width: `${viewportHighlightWidth}px`,
              }}
              onPointerDown={(event) => {
                if (!onViewportDragStart) return;
                event.preventDefault();
                onViewportDragStart(event);
              }}
            />
          </div>
          <div
            className="relative h-full overflow-hidden"
            aria-hidden="true"
            style={{ width: `${containerWidth}px` }}
          >
            <canvas ref={canvasRef} className="absolute inset-0" />
          </div>
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-primary/80"
            style={{ left: `${playheadPosition}px` }}
          />
        </div>
      </div>
    );
  },
);

Timeline.displayName = "Timeline";
