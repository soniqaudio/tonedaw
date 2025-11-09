"use client";

import { useEffect, useRef } from "react";
import type { MidiNoteClip } from "@/core/midi/types";
import { useTrackStore } from "@/core/stores/useTrackStore";
import { prepareCanvas } from "../lib/canvas";

interface NotesLayerProps {
  width: number;
  height: number;
  clips: MidiNoteClip[];
  noteToIndex: Map<string, number>;
  msPerBeat: number;
  pixelsPerBeat: number;
  keyHeight: number;
  notePadding: number;
  scrollLeft: number;
  viewportWidth: number;
}

export const NotesLayer = ({
  width,
  height,
  clips,
  noteToIndex,
  msPerBeat,
  pixelsPerBeat,
  keyHeight,
  notePadding,
  scrollLeft,
  viewportWidth,
}: NotesLayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracks = useTrackStore((state) => state.tracks);

  // Build trackId -> color map
  const trackColorMap = new Map<string, string>();
  tracks.forEach((track) => {
    trackColorMap.set(track.id, track.color);
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = prepareCanvas(canvas, width, height);

    // Clear the canvas
    ctx.clearRect(0, 0, width, height);

    const noteStroke = "rgba(255,255,255,0.24)";

    // Build fresh trackId -> color map inside effect
    const freshTrackColorMap = new Map<string, string>();
    tracks.forEach((track) => {
      freshTrackColorMap.set(track.id, track.color);
    });

    // Viewport culling - get viewport bounds
    const viewLeft = scrollLeft;
    const viewRight = viewLeft + viewportWidth;

    // Translate context to handle scroll offset
    ctx.save();
    ctx.translate(-scrollLeft, 0);

    // Set font style once
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";

    // Draw visible notes only (with small margin for smooth scrolling)
    const margin = 100; // pixels
    clips.forEach((clip) => {
      const keyIndex = noteToIndex.get(clip.noteName);
      if (keyIndex === undefined) return;

      const startBeats = clip.start / msPerBeat;
      const durationBeats = clip.duration / msPerBeat;
      const left = startBeats * pixelsPerBeat + notePadding;
      const widthPx = Math.max(durationBeats * pixelsPerBeat - notePadding * 2, 4);

      // Skip if note is completely off-screen
      if (left + widthPx < viewLeft - margin || left > viewRight + margin) return;

      const top = keyIndex * keyHeight + 1;
      const heightPx = keyHeight - 2;

      // Get track color or use default
      const trackColor = freshTrackColorMap.get(clip.trackId) || "#3b82f6";
      const isPreview = (clip as unknown as { isPreview?: boolean }).isPreview;
      const noteFill = isPreview ? "rgba(96,165,250,0.28)" : `${trackColor}55`; // Add alpha for transparency
      const strokeColor = isPreview ? "rgba(148,163,184,0.45)" : noteStroke;

      // Draw note rectangle
      ctx.fillStyle = noteFill;
      ctx.fillRect(left, top, widthPx, heightPx);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(left, top, widthPx, heightPx);

      // Draw note text (only for wider notes)
      if (!isPreview && widthPx >= 24) {
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        const text = `${clip.noteName}`;
        ctx.fillText(text, left + 4, top + heightPx / 2);
      }
    });

    ctx.restore();

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
    clips,
    noteToIndex,
    msPerBeat,
    pixelsPerBeat,
    keyHeight,
    width,
    height,
    notePadding,
    scrollLeft,
    viewportWidth,
    tracks,
  ]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 block" />;
};
