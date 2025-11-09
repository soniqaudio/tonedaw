"use client";

import { useEffect, useMemo, useRef } from "react";
import type { MidiNoteClip } from "@/core/midi/types";
import { prepareCanvas } from "../lib/canvas";

interface DynamicOverlayProps {
  width: number;
  height: number;
  playheadX: number;
  activeNotes: Set<number>;
  clips: MidiNoteClip[];
  noteToIndex: Map<string, number>;
  msPerBeat: number;
  pixelsPerBeat: number;
  keyHeight: number;
  notePadding: number;
  scrollLeft: number;
  viewportWidth: number;
  selectionRect?: { x0: number; y0: number; x1: number; y1: number } | null;
  selectedClipIds?: string[];
  playheadMs?: number;
}

export const DynamicOverlay = ({
  width,
  height,
  playheadX,
  activeNotes,
  clips,
  noteToIndex,
  msPerBeat,
  pixelsPerBeat,
  keyHeight,
  notePadding,
  scrollLeft,
  viewportWidth,
  selectionRect,
  selectedClipIds = [],
  playheadMs = 0,
}: DynamicOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const playheadActiveClips = useMemo(() => {
    if (playheadMs == null) return [];

    const toleranceMs = 8; // small buffer to avoid flicker at boundaries

    return clips.filter((clip) => {
      const clipStart = clip.start;
      const clipEnd = clip.start + clip.duration;
      return playheadMs + toleranceMs >= clipStart && playheadMs - toleranceMs <= clipEnd;
    });
  }, [clips, playheadMs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = prepareCanvas(canvas, width, height);

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    const activeNoteFill = "rgba(99, 102, 241, 0.55)";
    const playheadOverlapFill = "rgba(99, 102, 241, 0.35)";
    const playheadColor = "rgba(99,102,241,0.9)";

    // Viewport culling
    const viewLeft = scrollLeft;
    const viewRight = viewLeft + viewportWidth;
    const margin = 100;

    // Translate context to handle scroll offset
    ctx.save();
    ctx.translate(-scrollLeft, 0);

    // Draw selected clips outline first (so they appear under active notes)
    if (selectedClipIds.length > 0) {
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      ctx.lineWidth = 2;

      for (const clip of clips) {
        if (selectedClipIds.includes(clip.id)) {
          const noteIndex = noteToIndex.get(clip.noteName);
          if (noteIndex === undefined) continue;

          const x = (clip.start / msPerBeat) * pixelsPerBeat;
          const y = noteIndex * keyHeight;
          const noteWidth = (clip.duration / msPerBeat) * pixelsPerBeat;

          // Skip if off-screen
          if (x + noteWidth < viewLeft - margin || x > viewRight + margin) continue;

          ctx.strokeRect(
            x + notePadding,
            y + notePadding,
            noteWidth - notePadding * 2,
            keyHeight - notePadding * 2,
          );
        }
      }
    }

    // Set font style once
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";

    // Draw playhead overlap highlights
    playheadActiveClips.forEach((clip) => {
      const keyIndex = noteToIndex.get(clip.noteName);
      if (keyIndex === undefined) return;

      const left = (clip.start / msPerBeat) * pixelsPerBeat + notePadding;
      const widthPx = Math.max((clip.duration / msPerBeat) * pixelsPerBeat - notePadding * 2, 4);

      // Skip if active note is off-screen
      if (left + widthPx < viewLeft - margin || left > viewRight + margin) return;

      const top = keyIndex * keyHeight + 1;
      const heightPx = keyHeight - 2;

      const isCurrentlySounding = activeNotes.has(clip.noteNumber);
      const fillColor = isCurrentlySounding ? activeNoteFill : playheadOverlapFill;

      // Active note overlay
      ctx.fillStyle = fillColor;
      ctx.fillRect(left, top, widthPx, heightPx);

      // Active note text (brighter, only for wider notes)
      if (widthPx >= 24) {
        ctx.fillStyle = "#FFFFFF";
        const text = `${clip.noteName}`;
        ctx.fillText(text, left + 4, top + heightPx / 2);
      }
    });

    // Draw selection rectangle (in world space, before restore)
    if (selectionRect) {
      const x = Math.min(selectionRect.x0, selectionRect.x1);
      const y = Math.min(selectionRect.y0, selectionRect.y1);
      const w = Math.abs(selectionRect.x1 - selectionRect.x0);
      const h = Math.abs(selectionRect.y1 - selectionRect.y0);

      ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
      ctx.strokeStyle = "rgba(59, 130, 246, 0.85)";
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    }

    ctx.restore();

    // Draw playhead in viewport coordinates (after restoring transform)
    const canvasX = playheadX - scrollLeft;
    const clampedPlayheadX = Math.max(0, Math.min(width, canvasX));
    ctx.beginPath();
    ctx.strokeStyle = playheadColor;
    ctx.lineWidth = 1;
    ctx.moveTo(clampedPlayheadX + 0.5, 0);
    ctx.lineTo(clampedPlayheadX + 0.5, height);
    ctx.stroke();

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
  }, [
    width,
    height,
    playheadX,
    playheadActiveClips,
    clips,
    activeNotes,
    noteToIndex,
    msPerBeat,
    pixelsPerBeat,
    keyHeight,
    notePadding,
    scrollLeft,
    viewportWidth,
    selectionRect,
    selectedClipIds,
  ]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 block" />;
};
