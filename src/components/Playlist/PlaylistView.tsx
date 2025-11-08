"use client";

const TOTAL_BARS = 16;
const BAR_WIDTH = 112;
const ROW_HEIGHT = 92;

const mockTracks = [
  {
    name: "Drums",
    type: "Pattern",
    badge: "PAT",
    color: "#5b7cfa",
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
    color: "#33d1bf",
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
    color: "#ff9f43",
    clips: [
      { start: 0, length: 4, label: "Verse" },
      { start: 4, length: 4, label: "Verse" },
      { start: 8, length: 8, label: "Hook" },
    ],
  },
  {
    name: "Vox",
    type: "Audio",
    badge: "AUDIO",
    color: "#e14eca",
    waveform: true,
    clips: [
      { start: 8, length: 4, label: "Adlibs" },
      { start: 12, length: 4, label: "FX" },
    ],
  },
  {
    name: "Automation",
    type: "Automation",
    badge: "AUTO",
    color: "#9b8aff",
    automation: true,
    clips: [{ start: 0, length: 16, label: "Filter Sweep" }],
  },
];

const timelineWidth = TOTAL_BARS * BAR_WIDTH;
const gridPattern =
  "linear-gradient(0deg, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)";

export function PlaylistView() {
  return (
    <div className="flex h-full w-full flex-col bg-[#05070b] text-white">
      <div className="flex items-center justify-between border-b border-white/5 px-6 py-3">
        <div>
          <p className="text-sm font-semibold text-white/85">Arrangement</p>
          <p className="text-xs text-white/35">Mocked timeline • drag & drop coming soon</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-semibold text-white/70 transition hover:border-white/40 hover:text-white"
        >
          + New Pattern
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 border-r border-white/5 bg-[#090c14]">
          {mockTracks.map((track) => (
            <div
              key={track.name}
              className="flex h-[92px] items-center justify-between border-b border-white/5 px-4"
            >
              <div>
                <p className="text-sm font-semibold text-white/85">{track.name}</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/30">{track.type}</p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ backgroundColor: `${track.color}22`, color: track.color }}
              >
                {track.badge}
              </span>
            </div>
          ))}
        </div>

        <div className="relative flex-1 overflow-auto bg-[#03050a]">
          <div
            className="sticky top-0 z-20 flex border-b border-white/5 bg-black/60 backdrop-blur"
            style={{ width: timelineWidth }}
          >
            {Array.from({ length: TOTAL_BARS }, (_, index) => (
              <div
                key={index}
                className="relative flex h-12 w-[112px] flex-col items-center justify-center border-r border-white/5 text-[11px] font-semibold text-white/45"
              >
                <span>{index + 1}</span>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[9px] text-white/20">
                  <span>•</span>
                  <span>•</span>
                  <span>•</span>
                </div>
              </div>
            ))}
          </div>

          <div
            className="relative"
            style={{
              width: timelineWidth,
              backgroundImage: gridPattern,
              backgroundSize: `${BAR_WIDTH}px ${ROW_HEIGHT / 2}px`,
            }}
          >
            {mockTracks.map((track, _rowIndex) => (
              <div
                key={track.name}
                className="relative"
                style={{ height: ROW_HEIGHT, borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                {track.clips.map((clip) => {
                  const clipWidth = Math.max(clip.length * BAR_WIDTH - 16, 64);
                  return (
                    <div
                      key={`${track.name}-${clip.label}-${clip.start}`}
                      className="absolute top-3 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/90 shadow-[0_16px_45px_rgba(0,0,0,0.55)]"
                      style={{
                        left: clip.start * BAR_WIDTH,
                        width: clipWidth,
                        background: `linear-gradient(130deg, ${track.color}f0, ${track.color}80)`,
                      }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span>{clip.label}</span>
                        <span className="text-[10px] uppercase tracking-[0.3em] text-white/70">
                          {track.badge}
                        </span>
                      </div>
                      {track.waveform ? (
                        <div className="mt-2 h-10 overflow-hidden rounded-lg bg-black/15">
                          <svg viewBox="0 0 120 32" className="h-full w-full opacity-80" role="img">
                            <title>{track.name} waveform mock</title>
                            <polyline
                              fill="none"
                              stroke="white"
                              strokeWidth={2}
                              strokeLinecap="round"
                              points="0,16 8,8 16,20 24,6 32,22 40,4 48,26 56,10 64,24 72,8 80,18 88,12 96,20 104,14 112,16 120,15"
                            />
                          </svg>
                        </div>
                      ) : null}
                      {track.automation ? (
                        <div className="mt-2 h-6">
                          <svg viewBox="0 0 120 24" className="h-full w-full opacity-90" role="img">
                            <title>{track.name} automation mock</title>
                            <path
                              d="M0 18 L15 6 L30 12 L45 4 L60 18 L75 10 L90 16 L105 8 L120 18"
                              fill="none"
                              stroke="white"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeDasharray="5 4"
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
