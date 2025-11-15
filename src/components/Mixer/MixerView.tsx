"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Channel {
  name: string;
  level: number;
  meterL: number;
  meterR: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  active: boolean;
  effects: Array<{ type: string; name: string } | null>;
}

const initialChannels: Channel[] = [
  { name: "Master", level: 0.85, meterL: 0.92, meterR: 0.9, pan: 0, muted: false, solo: false, active: true, effects: [null, null, null] },
  { name: "Drums", level: 0.7, meterL: 0.75, meterR: 0.73, pan: 0, muted: false, solo: false, active: true, effects: [null, null, null] },
  { name: "Bass", level: 0.6, meterL: 0.62, meterR: 0.6, pan: -0.05, muted: false, solo: false, active: true, effects: [null, null, null] },
  { name: "Chords", level: 0.55, meterL: 0.6, meterR: 0.58, pan: 0.2, muted: false, solo: false, active: true, effects: [null, null, null] },
  { name: "Lead", level: 0.5, meterL: 0.58, meterR: 0.55, pan: -0.15, muted: false, solo: false, active: true, effects: [null, null, null] },
  { name: "FX", level: 0.4, meterL: 0.45, meterR: 0.4, pan: 0, muted: false, solo: false, active: true, effects: [null, null, null] },
  { name: "Vox", level: 0.62, meterL: 0.66, meterR: 0.64, pan: -0.05, muted: true, solo: false, active: true, effects: [null, null, null] },
  { name: "Bus A", level: 0.35, meterL: 0.4, meterR: 0.39, pan: 0.1, muted: false, solo: false, active: true, effects: [null, null, null] },
];

const meterGradient = "linear-gradient(180deg, hsl(217, 91%, 45%) 0%, hsl(217, 91%, 55%) 50%, hsl(217, 91%, 65%) 100%)";

export function MixerView() {
  const [channels, setChannels] = useState(initialChannels);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState<number | null>(null);
  const draggingRef = useRef<{ channelIndex: number; startY: number; startLevel: number } | null>(null);

  const toggleState = (index: number, key: "muted" | "solo" | "active") => {
    setChannels((prev) =>
      prev.map((channel, idx) => (idx === index ? { ...channel, [key]: !channel[key] } : channel)),
    );
  };

  const handleChannelClick = (index: number) => {
    setSelectedChannelIndex(index);
  };

  const handleFaderMouseDown = (e: React.MouseEvent<HTMLDivElement>, channelIndex: number) => {
    e.preventDefault();
    const faderElement = e.currentTarget;
    const rect = faderElement.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    const level = Math.max(0, Math.min(1, 1 - y / height));
    
    draggingRef.current = {
      channelIndex,
      startY: e.clientY,
      startLevel: level,
    };

    setChannels((prev) =>
      prev.map((channel, idx) => (idx === channelIndex ? { ...channel, level } : channel)),
    );
  };

  // Add global mouse event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;

      const { channelIndex, startY, startLevel } = draggingRef.current;
      const faderElement = document.querySelector(`[data-fader-index="${channelIndex}"]`) as HTMLElement;
      if (!faderElement) return;

      const rect = faderElement.getBoundingClientRect();
      const deltaY = startY - e.clientY;
      const height = rect.height;
      const deltaLevel = deltaY / height;
      const newLevel = Math.max(0, Math.min(1, startLevel + deltaLevel));

      setChannels((prev) =>
        prev.map((channel, idx) => (idx === channelIndex ? { ...channel, level: newLevel } : channel)),
      );
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
    };

    if (typeof window !== "undefined") {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-base text-foreground">
      {/* Channel Strips */}
      <div className="flex flex-1 gap-4 overflow-auto px-6 py-8">
        {channels.map((channel, index) => {
          const meterLeftHeight = `${channel.meterL * 100}%`;
          const meterRightHeight = `${channel.meterR * 100}%`;
          const faderBottom = `${channel.level * 100}%`;
          const panPosition = channel.pan; // -1 to 1 range
          const isMaster = index === 0;
          
          const isSelected = selectedChannelIndex === index;
          
          return (
            <div
              key={channel.name}
              onClick={() => handleChannelClick(index)}
              className={cn(
                "flex w-24 flex-col rounded-md border bg-layer-1 px-3 py-4 shadow-layer-sm cursor-pointer transition-colors",
                isSelected
                  ? "border-primary"
                  : "border-subtle",
                isMaster && !isSelected && "border-primary/40"
              )}
            >
              {/* Label Zone */}
              <div className="mb-2 flex items-center justify-between">
                <p className="truncate text-sm font-semibold text-foreground">{channel.name}</p>
                <span className="text-[10px] text-tertiary">{isMaster ? "C" : index}</span>
              </div>

              {/* Active Button */}
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleState(index, "active");
                  }}
                  className={cn(
                    "h-5 w-full rounded-sm border text-[9px] font-semibold transition-colors shadow-layer-sm",
                    channel.active
                      ? "border-primary bg-primary text-white"
                      : "border-subtle bg-layer-1 text-muted-foreground hover:bg-layer-2 hover:text-foreground"
                  )}
                >
                  {channel.active ? "ON" : "OFF"}
                </button>
              </div>

              {/* Button Zone */}
              <div className="mb-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggleState(index, "solo")}
                  className={cn(
                    "h-6 rounded-sm border px-2 text-[10px] font-semibold transition-colors shadow-layer-sm",
                    channel.solo
                      ? "border-primary bg-primary text-white"
                      : "border-subtle bg-layer-1 text-muted-foreground hover:bg-layer-2 hover:text-foreground"
                  )}
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => toggleState(index, "muted")}
                  className={cn(
                    "h-6 rounded-sm border px-2 text-[10px] font-semibold transition-colors shadow-layer-sm",
                    channel.muted
                      ? "border-destructive bg-destructive text-white"
                      : "border-subtle bg-layer-1 text-muted-foreground hover:bg-layer-2 hover:text-foreground"
                  )}
                >
                  M
                </button>
              </div>

              {/* Meter Labels */}
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-tertiary">
                <span>L</span>
                <span>R</span>
              </div>

              {/* Meter Zone */}
              <div className="mb-4 flex gap-2">
                {[meterLeftHeight, meterRightHeight].map((height, meterIdx) => (
                  <div
                    key={meterIdx}
                    className="relative h-32 w-4 rounded-sm bg-layer-1 shadow-layer-inset"
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-sm"
                      style={{ height, backgroundImage: meterGradient }}
                    />
                  </div>
                ))}
              </div>

              {/* Pan Zone */}
              <div className="mb-4 flex flex-col items-center">
                <p className="mb-2 text-[10px] text-tertiary">Pan</p>
                <div className="relative h-10 w-10 rounded-full border border-subtle bg-layer-1 shadow-layer-inset">
                  {/* Pan indicator line at top */}
                  <div
                    className="absolute left-1/2 top-0 h-3 w-0.5 -translate-x-1/2 bg-foreground transition-transform origin-bottom"
                    style={{
                      transform: `translateX(-50%) rotate(${panPosition * 45}deg)`,
                    }}
                  />
                  {/* Center dot */}
                  <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
                </div>
              </div>

              {/* Fader Zone */}
              <div className="flex-1 flex items-start gap-2">
                <div
                  data-fader-index={index}
                  className={cn(
                    "relative mx-auto h-48 w-10 rounded-none border shadow-layer-inset cursor-pointer select-none",
                    isSelected
                      ? "border-primary"
                      : "border-subtle bg-layer-1"
                  )}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleFaderMouseDown(e, index);
                    handleChannelClick(index);
                  }}
                >
                  {/* Blue fill from bottom to volume position (FL Studio style) */}
                  {isSelected && (
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-primary/30 transition-all"
                      style={{ height: faderBottom }}
                    />
                  )}
                  {/* Center line */}
                  <div className="absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 border-l border-dashed border-subtle" />
                  {/* Fader handle */}
                  <div
                    className={cn(
                      "absolute left-1/2 h-5 w-8 -translate-x-1/2 rounded-full text-[10px] font-semibold shadow-lg transition-colors cursor-grab active:cursor-grabbing",
                      isSelected
                        ? "bg-primary text-white"
                        : "bg-white text-black hover:bg-primary hover:text-white"
                    )}
                    style={{ bottom: faderBottom }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      {Math.round(channel.level * 10)}
                    </span>
                  </div>
                </div>
                {/* dB Values */}
                <div className="flex flex-col justify-between h-48 text-[10px] text-tertiary pt-2 pb-2">
                  <span>+8</span>
                  <span>+4</span>
                  <span>0</span>
                  <span>-4</span>
                  <span>-8</span>
                </div>
              </div>

              {/* Effect Slots */}
              <div className="mt-4 flex flex-col gap-1.5">
                {channel.effects.map((effect, effectIdx) => (
                  <button
                    key={effectIdx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Open effect selector
                    }}
                    className={cn(
                      "h-6 w-full rounded-sm border text-[9px] font-medium transition-colors shadow-layer-sm",
                      effect
                        ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                        : "border-subtle bg-layer-1 text-muted-foreground hover:bg-layer-2 hover:text-foreground"
                    )}
                  >
                    {effect ? effect.name : effectIdx === 0 ? "EQ" : effectIdx === 1 ? "Reverb" : "FX"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
