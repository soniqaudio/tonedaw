"use client";

import { useEffect, useRef } from "react";
import { getColor, prepareCanvas } from "../lib/canvas";

interface StaticGridProps {
  width: number;
  height: number;
  keyHeight: number;
  pixelsPerBeat: number;
  scrollLeft: number;
  subdivisionsPerBeat: number;
}

export const StaticGrid = ({
  width,
  height,
  keyHeight,
  pixelsPerBeat,
  scrollLeft,
  subdivisionsPerBeat,
}: StaticGridProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = prepareCanvas(canvas, width, height, { alpha: false });

    // Clear the visible viewport region
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);

    // Base alternating row fills (dark neutrals)
    const ROW_A = "#0b0b0d";
    const ROW_B = "#111115";
    for (let y = 0; y < height; y += keyHeight * 2) {
      ctx.fillStyle = ROW_A;
      ctx.fillRect(0, y, width, keyHeight);
      const yB = y + keyHeight;
      if (yB < height) {
        ctx.fillStyle = ROW_B;
        ctx.fillRect(0, yB, width, keyHeight);
      }
    }

    // Vertical block shading: every 4 beats (1 bar) alternates light/dark
    const beatsPerMeasure = 4;
    const beatsPerBlock = beatsPerMeasure; // Changed from beatsPerMeasure * 4 to just beatsPerMeasure
    const firstBlock = Math.floor(scrollLeft / (pixelsPerBeat * beatsPerBlock));
    const blocksInView = Math.ceil(width / (pixelsPerBeat * beatsPerBlock)) + 2;
    const lightColor = "rgba(255,255,255,0.02)";
    const darkColor = "rgba(0,0,0,0.04)";

    for (let block = firstBlock; block <= firstBlock + blocksInView; block++) {
      const blockStartBeat = block * beatsPerBlock;
      const blockStartX = blockStartBeat * pixelsPerBeat - scrollLeft;
      const blockWidth = beatsPerBlock * pixelsPerBeat;
      const isLight = block % 2 === 0;
      ctx.fillStyle = isLight ? lightColor : darkColor;
      ctx.fillRect(blockStartX, 0, blockWidth, height);
    }

    const firstBeat = Math.floor(scrollLeft / pixelsPerBeat);
    const beatsInView = Math.ceil(width / pixelsPerBeat) + 2;
    const gridStrongColor = getColor("--grid-line-strong", "rgba(255,255,255,0.16)");
    const gridBeatColor = getColor("--grid-line-beat", "rgba(255,255,255,0.08)");
    const gridSubdivisionColor = "rgba(255,255,255,0.03)";

    ctx.lineWidth = 1;
    for (let beat = firstBeat; beat <= firstBeat + beatsInView; beat++) {
      const xViewport = beat * pixelsPerBeat - scrollLeft;
      const x = Math.round(xViewport) + 0.5;
      const isMeasure = beat % beatsPerMeasure === 0;

      ctx.beginPath();
      ctx.strokeStyle = isMeasure ? gridStrongColor : gridBeatColor;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      const stepsPerBeat = Math.max(1, Math.round(subdivisionsPerBeat));
      const stepWidth = pixelsPerBeat / stepsPerBeat;
      if (stepsPerBeat > 1 && stepWidth >= 6) {
        for (let sub = 1; sub < stepsPerBeat; sub++) {
          const subXViewport = beat * pixelsPerBeat + stepWidth * sub - scrollLeft;
          const subX = Math.round(subXViewport) + 0.5;
          ctx.beginPath();
          ctx.strokeStyle = gridSubdivisionColor;
          ctx.moveTo(subX, 0);
          ctx.lineTo(subX, height);
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
  }, [width, height, pixelsPerBeat, keyHeight, scrollLeft, subdivisionsPerBeat]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 block" />;
};
