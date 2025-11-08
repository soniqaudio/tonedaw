"use client";

import { useState } from "react";

const chips = ["All", "Drums", "Synth", "Keys", "Guitar", "FX"];

const sounds = [
  { title: "Kick 808", category: "Drums", favorite: true },
  { title: "Snare Tight", category: "Drums", favorite: false },
  { title: "Hi-Hat Closed", category: "Drums", favorite: false },
  { title: "Bass Synth", category: "Synth", favorite: true },
  { title: "Lead Pluck", category: "Synth", favorite: false },
  { title: "Pad Ambient", category: "Synth", favorite: false },
  { title: "Piano C4", category: "Keys", favorite: false },
  { title: "Guitar Strum", category: "Guitar", favorite: true },
];

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg
    aria-hidden="true"
    className={`h-3.5 w-3.5 ${filled ? "text-amber-300" : "text-white/25"}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M10 2.5l2.35 4.76 5.15.75-3.74 3.65.88 5.14L10 14.92 5.36 16.8l.88-5.14L2.5 8.01l5.15-.75z" />
  </svg>
);

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<"browser" | "ai">("browser");

  return (
    <aside className="hidden w-72 shrink-0 border-r border-white/5 bg-[rgba(9,9,12,0.96)] text-zinc-200 lg:flex lg:flex-col">
      <div className="flex items-center border-b border-white/5 px-5 py-3">
        {[
          { id: "browser", label: "Browser" },
          { id: "ai", label: "AI" },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as "browser" | "ai")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isActive ? "bg-white/10 text-white" : "text-zinc-500 hover:text-white"
              }`}
              aria-pressed={isActive}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "browser" ? (
        <>
          <div className="px-5 py-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search sounds..."
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              />
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m16 16 4 4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    chip === "All"
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto px-5">
            <ul className="space-y-2">
              {sounds.map((sound) => (
                <li
                  key={sound.title}
                  className="flex items-center justify-between rounded-lg border border-transparent px-2 py-2 text-sm text-white transition-colors hover:border-white/10 hover:bg-white/5"
                >
                  <div>
                    <p className="font-medium text-white">{sound.title}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {sound.category}
                    </p>
                  </div>
                  <StarIcon filled={sound.favorite} />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 px-5 py-3 text-xs text-zinc-500">
            <span>{sounds.length} sounds</span>
            <span>0:00</span>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-5 py-6 text-sm text-zinc-400">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-base font-semibold text-white">AI Composer</p>
            <p className="mt-1 text-sm text-zinc-500">
              Chat with Tone AI to generate one-shots, chord progressions, or MIDI ideas.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-400">
              <p>"Give me a melancholic pad progression at 120 BPM"</p>
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Open Chat
            </button>
          </div>
          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center">
            <p className="text-sm text-zinc-500">
              AI sound design coming soon. Drop prompts here to preview future workflows.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
