"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { audioEngine } from "@/core/audio/audioEngine";
import { PIANO_ROLL } from "@/core/constants/pianoRoll";
import { getRootNotes, getScaleNames } from "@/core/music/scales";
import { useMetronomeStore } from "@/core/stores/useMetronomeStore";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { useMusicTheoryStore } from "@/core/stores/useMusicTheoryStore";
import { useTransportStore } from "@/core/stores/useTransportStore";
import { useUIStore } from "@/core/stores/useUIStore";
import type { WorkspaceView } from "@/core/stores/useViewStore";
import { useViewStore } from "@/core/stores/useViewStore";
import { TopBarMidiControls } from "./TopBarMidiControls";

const VIEW_OPTIONS: Array<{ id: WorkspaceView; label: string; shortcut: string }> = [
  { id: "piano-roll", label: "Piano Roll", shortcut: "F7" },
  { id: "playlist", label: "Playlist", shortcut: "F5" },
  { id: "mixer", label: "Mixer", shortcut: "F9" },
];

const formatTimecode = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  const centiseconds = Math.floor((ms % 1000) / 10)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}:${centiseconds}`;
};

interface SettingsToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

const SettingsToggle = ({ label, description, enabled, onToggle }: SettingsToggleProps) => (
  <button
    type="button"
    onClick={onToggle}
    className="flex w-full items-center justify-between rounded-md border border-white/5 px-3 py-2 text-left transition-colors hover:border-white/10 hover:bg-white/5"
    aria-pressed={enabled}
  >
    <div>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-xs text-zinc-500">{description}</p>
    </div>
    <span
      className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${
        enabled ? "bg-primary/70" : "bg-white/10"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </span>
  </button>
);

interface MenuItem {
  label: string;
  shortcut?: string;
  onSelect?: () => void;
}

const MenuDropdown = ({ label, items }: { label: string; items: MenuItem[] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
          open ? "text-white" : "text-zinc-500 hover:text-white"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
        <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute left-0 mt-2 w-48 rounded-2xl border border-white/10 bg-[rgba(10,10,14,0.95)] p-2 shadow-layer-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span>{item.label}</span>
              {item.shortcut ? (
                <span className="text-xs text-zinc-500">{item.shortcut}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

interface TopBarProps {
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
}

export default function TopBar({ isPlaying, onPlay, onStop }: TopBarProps) {
  const idPrefix = useId();
  const gridSelectId = `${idPrefix}-grid`;
  const keySelectId = `${idPrefix}-key`;
  const scaleSelectId = `${idPrefix}-scale`;
  const tempoInputId = `${idPrefix}-tempo`;

  const tempo = useMusicTheoryStore((state) => state.tempo);
  const setTempo = useMusicTheoryStore((state) => state.actions.setTempo);
  const rootNote = useMusicTheoryStore((state) => state.rootNote);
  const setRootNote = useMusicTheoryStore((state) => state.actions.setRootNote);
  const scale = useMusicTheoryStore((state) => state.scale);
  const setScale = useMusicTheoryStore((state) => state.actions.setScale);
  const recordArm = useMidiStore((state) => state.recordArm);
  const setRecordArm = useMidiStore((state) => state.actions.setRecordArm);
  const computerInputEnabled = useMidiStore((state) => state.computerInputEnabled);
  const setComputerInputEnabled = useMidiStore((state) => state.actions.setComputerInputEnabled);
  const showGhostNotes = useUIStore((state) => state.showGhostNotes);
  const setShowGhostNotes = useUIStore((state) => state.actions.setShowGhostNotes);
  const followPlayhead = useUIStore((state) => state.pianoRollFollowPlayhead);
  const setPianoRollFollow = useUIStore((state) => state.actions.setPianoRollFollow);
  const showSustainExtended = useUIStore((state) => state.showSustainExtended);
  const toggleSustainExtended = useUIStore((state) => state.actions.toggleSustainExtended);
  const gridResolutionId = useUIStore((state) => state.pianoRollGridResolution);
  const setGridResolution = useUIStore((state) => state.actions.setPianoRollGridResolution);
  const activeView = useViewStore((state) => state.activeView);
  const setActiveView = useViewStore((state) => state.actions.setActiveView);

  const playheadMs = useTransportStore((state) => state.playheadMs);
  const setPlayheadMs = useTransportStore((state) => state.actions.setPlayheadMs);

  const metronomeEnabled = useMetronomeStore((state) => state.enabled);
  const toggleMetronome = useMetronomeStore((state) => state.actions.toggle);

  const undo = useStore(useMidiStore.temporal, (state) => state.undo);
  const redo = useStore(useMidiStore.temporal, (state) => state.redo);
  const canUndo = useStore(useMidiStore.temporal, (state) => state.pastStates.length > 0);
  const canRedo = useStore(useMidiStore.temporal, (state) => state.futureStates.length > 0);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (!cmdOrCtrl || e.key !== "z") return;
      e.preventDefault();
      if (e.shiftKey) {
        if (canRedo) redo();
        return;
      }
      if (canUndo) undo();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  const msPerBeat = useMemo(() => 60000 / Math.max(tempo, 1), [tempo]);
  const formattedTime = formatTimecode(playheadMs);

  const handleStop = () => onStop();
  const handlePlay = () => onPlay();
  const handleMetronomeToggle = () => {
    audioEngine.ensureMetronomeReady();
    toggleMetronome();
  };

  const controlBlock =
    "flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5";
  const iconButtonClass = (active = false) =>
    `flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
      active
        ? "border-white/30 bg-white/10 text-white"
        : "border-transparent text-zinc-400 hover:border-white/15 hover:bg-white/5 hover:text-white"
    }`;

  const playButtonClass =
    "flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20";

  const recordButtonClass = recordArm
    ? "flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/50 bg-red-500/20 text-red-200"
    : "flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-zinc-400 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200";

  const settingsOptions = [
    {
      label: "Ghost notes",
      description: "Overlay notes from other tracks",
      enabled: showGhostNotes,
      onToggle: () => setShowGhostNotes(!showGhostNotes),
    },
    {
      label: "Sustain view",
      description: "Show pedal-extended notes",
      enabled: showSustainExtended,
      onToggle: () => toggleSustainExtended(),
    },
    {
      label: "Follow playhead",
      description: "Auto-scroll during playback",
      enabled: followPlayhead,
      onToggle: () => setPianoRollFollow(!followPlayhead),
    },
    {
      label: "Typing keyboard",
      description: "Play notes with QWERTY keys",
      enabled: computerInputEnabled,
      onToggle: () => setComputerInputEnabled(!computerInputEnabled),
    },
  ];

  const fileMenuItems: MenuItem[] = [
    { label: "New Project", shortcut: "⌘N" },
    { label: "Open", shortcut: "⌘O" },
    { label: "Save", shortcut: "⌘S" },
    { label: "Export", shortcut: "⇧⌘E" },
  ];

  const editMenuItems: MenuItem[] = [
    { label: "Cut", shortcut: "⌘X" },
    { label: "Copy", shortcut: "⌘C" },
    { label: "Paste", shortcut: "⌘V" },
    { label: "Undo", shortcut: "⌘Z", onSelect: () => undo() },
    { label: "Redo", shortcut: "⇧⌘Z", onSelect: () => redo() },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[rgba(5,5,8,0.95)] text-sm text-zinc-200 backdrop-blur-2xl">
      <div className="flex h-16 items-center gap-4 px-4">
        <div className="flex min-w-[200px] items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white">
              tn
            </div>
            <div>
              <p className="text-sm font-semibold text-white">tone</p>
              <p className="text-xs text-zinc-500">Untitled Project</p>
            </div>
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <MenuDropdown label="File" items={fileMenuItems} />
            <MenuDropdown label="Edit" items={editMenuItems} />
          </div>
        </div>

        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          <div className={`${controlBlock} hidden lg:flex`}>
            {VIEW_OPTIONS.map((option) => {
              const isActive = activeView === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveView(option.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
                  }`}
                  aria-pressed={isActive}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="lg:hidden">
            <select
              value={activeView}
              onChange={(event) => setActiveView(event.target.value as WorkspaceView)}
              className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              {VIEW_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={`${controlBlock} flex-1 justify-center`}>
            <button type="button" onClick={handleStop} className={iconButtonClass()} title="Stop">
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="7" y="7" width="10" height="10" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handlePlay}
              className={playButtonClass}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="8" y="6" width="3" height="12" rx="0.5" />
                  <rect x="13" y="6" width="3" height="12" rx="0.5" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={handleMetronomeToggle}
              className={iconButtonClass(metronomeEnabled)}
              title={metronomeEnabled ? "Metronome on" : "Metronome off"}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path d="M9 20h6l1.5-5-3-9H10l-3 9L8 20Z" strokeLinejoin="round" />
                <path d="M9 14h6" strokeLinecap="round" />
                <path d="M12 8l5 8" strokeLinecap="round" />
                <circle cx="17" cy="17" r="1.3" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setRecordArm(!recordArm)}
              className={recordButtonClass}
              title={recordArm ? "Recording armed" : "Arm recording"}
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="12" r="5" />
              </svg>
            </button>
          </div>

          <div className={`${controlBlock} hidden sm:flex items-center gap-3`}>
            <label
              className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500"
              htmlFor={tempoInputId}
            >
              BPM
            </label>
            <input
              id={tempoInputId}
              type="number"
              value={tempo}
              onChange={(event) => setTempo(Number(event.target.value))}
              className="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            />
            <div className="h-6 w-px bg-white/10" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Time
            </span>
            <span className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm font-mono text-white">
              {formattedTime}
            </span>
          </div>

          <div className={`${controlBlock} flex items-center gap-2`}>
            <label
              className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500"
              htmlFor={gridSelectId}
            >
              Grid
            </label>
            <select
              id={gridSelectId}
              value={gridResolutionId}
              onChange={(event) => setGridResolution(event.target.value)}
              className="w-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              {PIANO_ROLL.GRID_RESOLUTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`${controlBlock} hidden md:flex items-center gap-2`}>
            <TopBarMidiControls />
            <div className="h-6 w-px bg-white/10" />
            <button
              type="button"
              onClick={() => undo()}
              disabled={!canUndo}
              className={`${iconButtonClass()} h-8 w-8 disabled:cursor-not-allowed disabled:opacity-30`}
              title="Undo"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => redo()}
              disabled={!canRedo}
              className={`${iconButtonClass()} h-8 w-8 disabled:cursor-not-allowed disabled:opacity-30`}
              title="Redo"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                />
              </svg>
            </button>
          </div>

          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className={iconButtonClass(settingsOpen)}
              title="Session settings"
              aria-haspopup="true"
              aria-expanded={settingsOpen}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 2.5h3l.7 2.5c.4.1.8.3 1.2.6l2.5-.7 1.5 2.6-1.8 1.9c.1.3.1.6.1.9s0 .6-.1.9l1.8 1.9-1.5 2.6-2.5-.7c-.4.3-.8.5-1.2.6l-.7 2.5h-3l-.7-2.5c-.4-.1-.8-.3-1.2-.6l-2.5.7-1.5-2.6 1.8-1.9a5 5 0 01-.1-.9c0-.3 0-.6.1-.9l-1.8-1.9 1.5-2.6 2.5.7c.4-.3.8-.5 1.2-.6z"
                />
                <circle cx="12" cy="12" r="2.3" />
              </svg>
            </button>
            {settingsOpen ? (
              <div className="absolute right-0 mt-3 w-72 rounded-2xl border border-white/10 bg-[rgba(10,10,14,0.95)] p-3 shadow-layer-lg">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                  View Settings
                </p>
                <div className="space-y-2">
                  {settingsOptions.map((option) => (
                    <SettingsToggle key={option.label} {...option} />
                  ))}
                </div>
                <div className="mt-3 flex gap-2 text-xs text-zinc-500">
                  <label className="flex-1" htmlFor={keySelectId}>
                    Key
                    <select
                      id={keySelectId}
                      value={rootNote}
                      onChange={(event) => setRootNote(event.target.value)}
                      className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                    >
                      {getRootNotes().map((note) => (
                        <option key={note} value={note}>
                          {note}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1" htmlFor={scaleSelectId}>
                    Scale
                    <select
                      id={scaleSelectId}
                      value={scale}
                      onChange={(event) => setScale(event.target.value)}
                      className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                    >
                      {getScaleNames().map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
