"use client";

import { cn } from "@/lib/utils";

const TOTAL_BARS = 16;
const BAR_WIDTH = 112;
const ROW_HEIGHT = 64;

const mockTracks = [
  {
    name: "Drums",
    type: "Pattern",
    badge: "PAT",
    clips: [
      { start: 0, length: 4, label: "Intro" },
      { start: 4, length: 4, label: "Verse" },
      { start: 12, length: 4, label: "Fill" },
    ],
  },
  {
    name: "Bass",
    type: "Audio",
    badge: "AUDIO",
    waveform: true,
    clips: [
      { start: 0, length: 8, label: "Bassline" },
      { start: 8, length: 8, label: "Bassline" },
    ],
  },
  {
    name: "Chords",
    type: "Pattern",
    badge: "PAT",
    clips: [
      { start: 0, length: 4, label: "Verse" },
      { start: 4, length: 4, label: "Verse" },
      { start: 8, length: 8, label: "Hook" },
    ],
  },
  {
    name: "Lead",
    type: "Pattern",
    badge: "PAT",
    clips: [
      { start: 4, length: 4, label: "Melody" },
      { start: 10, length: 3, label: "Drop" },
      { start: 14, length: 2, label: "Outro" },
    ],
  },
  {
    name: "Vox",
    type: "Audio",
    badge: "AUDIO",
    waveform: true,
    clips: [
      { start: 8, length: 4, label: "Adlibs" },
      { start: 12, length: 4, label: "FX" },
    ],
  },
  {
    name: "Pad",
    type: "Audio",
    badge: "AUDIO",
    waveform: true,
    clips: [
      { start: 2, length: 6, label: "Ambient" },
      { start: 10, length: 6, label: "Swell" },
    ],
  },
  {
    name: "FX",
    type: "Pattern",
    badge: "PAT",
    clips: [
      { start: 7, length: 1, label: "Riser" },
      { start: 11, length: 2, label: "Impact" },
      { start: 15, length: 1, label: "Tail" },
    ],
  },
  {
    name: "Perc",
    type: "Audio",
    badge: "AUDIO",
    waveform: true,
    clips: [
      { start: 4, length: 4, label: "Shaker" },
      { start: 12, length: 4, label: "Claps" },
    ],
  },
];

const timelineWidth = TOTAL_BARS * BAR_WIDTH;

// Darker blue gradient for patterns
const patternGradient = "linear-gradient(135deg, hsl(217, 91%, 40%) 0%, hsl(217, 91%, 30%) 50%, hsl(217, 91%, 20%) 100%)";

export function PlaylistView() {
  return (
    <div className="flex h-full w-full flex-col bg-base text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Track List */}
        <div className="w-52 border-r border-border bg-layer-1">
          {/* Spacer to align with timeline */}
          <div className="h-8 border-b border-subtle" />
          {mockTracks.map((track, index) => (
            <div
              key={track.name}
              className="flex h-[92px] items-center justify-between border-b border-subtle px-4"
              style={{ height: `${ROW_HEIGHT}px` }}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{track.name}</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-tertiary">{track.type}</p>
              </div>
              <span
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] shadow-layer-sm",
                  track.type === "Pattern"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : track.type === "Audio"
                      ? "bg-layer-2 text-secondary border border-subtle"
                      : "bg-layer-2 text-tertiary border border-subtle"
                )}
              >
                {track.badge}
              </span>
            </div>
          ))}
        </div>

        {/* Timeline Area */}
        <div className="relative flex-1 overflow-auto bg-base">
          {/* Smaller Timeline Header */}
          <div
            className="sticky top-0 z-20 flex border-b border-border bg-layer-2 shadow-layer-sm"
            style={{ width: timelineWidth }}
          >
            {Array.from({ length: TOTAL_BARS }, (_, index) => (
              <div
                key={index}
                className="relative flex h-8 w-[112px] items-center justify-center border-r border-subtle text-[10px] font-semibold text-tertiary"
              >
                <span>{index + 1}</span>
              </div>
            ))}
          </div>

          {/* Grid and Clips */}
          <div
            className="relative"
            style={{
              width: timelineWidth,
              backgroundImage:
                "linear-gradient(0deg, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: `${BAR_WIDTH}px ${ROW_HEIGHT / 2}px`,
            }}
          >
            {mockTracks.map((track, trackIndex) => (
              <div
                key={track.name}
                className="relative border-b border-subtle"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                {track.clips.map((clip) => {
                  const clipWidth = Math.max(clip.length * BAR_WIDTH - 8, 64);
                  const isPattern = track.type === "Pattern";
                  const isAudio = track.type === "Audio";
                  const isAutomation = track.type === "Automation";

                  return (
                    <div
                      key={`${track.name}-${clip.label}-${clip.start}`}
                      className={cn(
                        "absolute rounded-md border px-3 py-2 text-sm font-semibold shadow-layer-md transition-all hover:shadow-layer-lg flex flex-col",
                        isPattern && "border-transparent",
                        isAudio && "border-subtle",
                        isAutomation && "border-subtle"
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
                          {track.badge}
                        </span>
                      </div>
                      {track.waveform ? (
                        <div className="mt-1 flex-1 overflow-hidden rounded-sm bg-black/20">
                          <svg viewBox="0 0 120 32" className="h-full w-full opacity-60" role="img">
                            <title>{track.name} waveform mock</title>
                            <polyline
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              points="0,16 8,8 16,20 24,6 32,22 40,4 48,26 56,10 64,24 72,8 80,18 88,12 96,20 104,14 112,16 120,15"
                            />
                          </svg>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
