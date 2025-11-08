"use client";

import { useMemo } from "react";
import { useMidiStore } from "@/core/stores/useMidiStore";

const MidiIcon = () => (
  <svg
    aria-hidden="true"
    className="h-3.5 w-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
  >
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <rect x="6" y="14" width="2" height="3" rx="0.5" />
    <rect x="11" y="14" width="2" height="3" rx="0.5" />
    <rect x="16" y="14" width="2" height="3" rx="0.5" />
    <path d="M6 9h12" />
  </svg>
);

interface TopBarMidiControlsProps {
  className?: string;
}

export const TopBarMidiControls = ({ className }: TopBarMidiControlsProps) => {
  const midiAccessState = useMidiStore((s) => s.midiAccessState);
  const midiAccessError = useMidiStore((s) => s.midiAccessError);
  const inputs = useMidiStore((s) => s.devices);
  const selectedInputId = useMidiStore((s) => s.selectedInputId);
  const { selectInput, triggerMidiAccessRequest } = useMidiStore((s) => s.actions);

  const statusColor = useMemo(() => {
    if (midiAccessError || midiAccessState === "denied") return "var(--error)";
    if (midiAccessState === "granted" && inputs.length > 0) return "var(--primary)";
    if (midiAccessState === "requesting") return "var(--text-secondary)";
    return "var(--text-tertiary)";
  }, [midiAccessError, midiAccessState, inputs.length]);

  const handleConnectClick = () => {
    triggerMidiAccessRequest();
  };

  const baseClass = "flex items-center gap-2";
  const containerClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={handleConnectClick}
        disabled={midiAccessState === "requesting"}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-zinc-400 transition-colors hover:border-white/15 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ color: statusColor }}
        title="Connect MIDI"
      >
        <MidiIcon />
      </button>
      {inputs.length > 0 && (
        <select
          value={selectedInputId || ""}
          onChange={(e) => selectInput(e.target.value || undefined)}
          className="min-w-[10rem] rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          style={{ color: selectedInputId ? "var(--text-primary)" : "var(--text-tertiary)" }}
        >
          <option value="">Choose MIDI</option>
          {inputs.map((input) => (
            <option key={input.id} value={input.id}>
              {input.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
