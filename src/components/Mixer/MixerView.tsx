"use client";

import { useState } from "react";

interface Channel {
  name: string;
  level: number;
  meterL: number;
  meterR: number;
  pan: number;
  muted: boolean;
  solo: boolean;
}

const initialChannels: Channel[] = [
  { name: "Master", level: 0.85, meterL: 0.92, meterR: 0.9, pan: 0, muted: false, solo: false },
  { name: "Drums", level: 0.7, meterL: 0.75, meterR: 0.73, pan: 0, muted: false, solo: false },
  { name: "Bass", level: 0.6, meterL: 0.62, meterR: 0.6, pan: -0.05, muted: false, solo: false },
  { name: "Chords", level: 0.55, meterL: 0.6, meterR: 0.58, pan: 0.2, muted: false, solo: false },
  { name: "Lead", level: 0.5, meterL: 0.58, meterR: 0.55, pan: -0.15, muted: false, solo: false },
  { name: "FX", level: 0.4, meterL: 0.45, meterR: 0.4, pan: 0, muted: false, solo: false },
  { name: "Vox", level: 0.62, meterL: 0.66, meterR: 0.64, pan: -0.05, muted: true, solo: false },
  { name: "Bus A", level: 0.35, meterL: 0.4, meterR: 0.39, pan: 0.1, muted: false, solo: false },
];

const meterGradient = "linear-gradient(180deg, #28f78c 0%, #18b6b2 40%, #f5d547 70%, #ff4b6e 100%)";

export function MixerView() {
  const [channels, setChannels] = useState(initialChannels);

  const toggleState = (index: number, key: "muted" | "solo") => {
    setChannels((prev) =>
      prev.map((channel, idx) => (idx === index ? { ...channel, [key]: !channel[key] } : channel)),
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#030407] text-white">
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-3">
        <div>
          <p className="text-sm font-semibold text-white/80">Console</p>
          <p className="text-xs text-white/35">Mock faders • automation and inserts coming soon</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/60 hover:text-white"
          >
            Wide
          </button>
          <button
            type="button"
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/60 hover:text-white"
          >
            Compact
          </button>
        </div>
      </div>
      <div className="flex flex-1 gap-4 overflow-auto px-6 py-8">
        {channels.map((channel, index) => {
          const meterLeftHeight = `${channel.meterL * 100}%`;
          const meterRightHeight = `${channel.meterR * 100}%`;
          const faderBottom = `${channel.level * 100}%`;
          const panRotation = `${channel.pan * 45}deg`;
          const isMaster = index === 0;
          return (
            <div
              key={channel.name}
              className={`flex w-28 flex-col rounded-[32px] border border-white/5 bg-white/[0.02] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                isMaster ? "border-primary/40" : ""
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="truncate text-sm font-semibold text-white/85">{channel.name}</p>
                <span className="text-[10px] text-white/40">{isMaster ? "C" : index}</span>
              </div>
              <div className="mb-4 flex items-center justify-between text-[11px] text-white/45">
                <button
                  type="button"
                  onClick={() => toggleState(index, "solo")}
                  className={`h-6 w-6 rounded-full border text-[10px] font-semibold ${
                    channel.solo
                      ? "border-cyan-400 bg-cyan-400/20 text-cyan-200"
                      : "border-white/15 hover:border-white/35"
                  }`}
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={() => toggleState(index, "muted")}
                  className={`h-6 w-6 rounded-full border text-[10px] font-semibold ${
                    channel.muted
                      ? "border-red-500 bg-red-500/20 text-red-200"
                      : "border-white/15 hover:border-white/35"
                  }`}
                >
                  M
                </button>
              </div>
              <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-white/40">
                <span>L</span>
                <span>R</span>
              </div>
              <div className="mb-4 flex gap-1">
                {[meterLeftHeight, meterRightHeight].map((height, meterIdx) => (
                  <div key={meterIdx} className="relative h-32 w-4 rounded-full bg-black/70">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-full"
                      style={{ height, backgroundImage: meterGradient }}
                    />
                  </div>
                ))}
              </div>
              <div className="mb-4 flex flex-col items-center text-[10px] text-white/50">
                <p>Pan</p>
                <div className="mt-2 h-12 w-12 rounded-full border border-white/15 bg-black/50">
                  <div
                    className="relative h-full w-full"
                    style={{ transform: `rotate(${panRotation})` }}
                  >
                    <span className="absolute inset-0 m-auto block h-0.5 w-6 rounded-full bg-white" />
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="relative h-48 w-12 rounded-full border border-white/15 bg-black/40 px-2">
                  <div className="absolute inset-x-1 top-3 bottom-3 border-l border-dashed border-white/10" />
                  <div
                    className="absolute left-1/2 h-5 w-6 -translate-x-1/2 rounded-full bg-white text-[10px] font-semibold text-black shadow-lg"
                    style={{ bottom: faderBottom }}
                  >
                    <span className="absolute inset-0 flex items-center justify-center">
                      {Math.round(channel.level * 10)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-between text-[11px] text-white/40">
                <span>-inf</span>
                <span>0 dB</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
