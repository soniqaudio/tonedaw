"use client";

import { useEffect, useRef } from "react";
import type { MidiNoteClip } from "@/core/midi/types";
import { useTrackStore } from "@/core/stores/useTrackStore";
import { prepareCanvas } from "../lib/canvas";

interface GhostNotesLayerProps {
  width: number;
  height: number;
  ghostClips: MidiNoteClip[];
  noteToIndex: Map<string, number>;
  msPerBeat: number;
  pixelsPerBeat: number;
  keyHeight: number;
  notePadding: number;
  scrollLeft: number;
  viewportWidth: number;
}

const ALPHA_HEX = "33"; // ~20% opacity

export const GhostNotesLayer = ({
  width,
  height,
  ghostClips,
  noteToIndex,
  msPerBeat,
  pixelsPerBeat,
  keyHeight,
  notePadding,
  scrollLeft,
  viewportWidth,
}: GhostNotesLayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracks = useTrackStore((state) => state.tracks);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = prepareCanvas(canvas, width, height);
    ctx.clearRect(0, 0, width, height);

    const trackColorMap = new Map<string, string>();
    tracks.forEach((track) => {
      trackColorMap.set(track.id, track.color);
    });

    const viewLeft = scrollLeft;
    const viewRight = viewLeft + viewportWidth;
    const margin = 120;

    ctx.save();
    ctx.translate(-scrollLeft, 0);
    ctx.lineWidth = 1;

    ghostClips.forEach((clip) => {
      const keyIndex = noteToIndex.get(clip.noteName);
      if (keyIndex === undefined) return;

      const startBeats = clip.start / msPerBeat;
      const durationBeats = clip.duration / msPerBeat;
      const left = startBeats * pixelsPerBeat + notePadding;
      const widthPx = Math.max(durationBeats * pixelsPerBeat - notePadding * 2, 4);

      if (left + widthPx < viewLeft - margin || left > viewRight + margin) return;

      const top = keyIndex * keyHeight + 1;
      const heightPx = keyHeight - 2;
      const trackColor = trackColorMap.get(clip.trackId) || "#64748b";
      const fill = `${trackColor}${ALPHA_HEX}`;

      ctx.fillStyle = fill;
      ctx.strokeStyle = `${trackColor}44`;
      ctx.setLineDash([6, 7]);
      ctx.fillRect(left, top, widthPx, heightPx);
      ctx.strokeRect(left, top, widthPx, heightPx);
    });

    ctx.restore();
  }, [
    ghostClips,
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
