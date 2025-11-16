"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { ChevronDown, Play, Pause, Square, Circle, Scissors, Settings, Music } from "lucide-react";
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
import { usePatternStore } from "@/core/stores/usePatternStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TopBarMidiControls } from "./TopBarMidiControls";
import { VerticalZoomControl } from "./piano-roll/VerticalZoomControl";

const VIEW_OPTIONS: Array<{ id: WorkspaceView; label: string; shortcut: string }> = [
  { id: "playlist", label: "Playlist", shortcut: "F5" },
  { id: "piano-roll", label: "Piano Roll", shortcut: "F7" },
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
    className="flex w-full items-center justify-between rounded-sm border border-border px-3 py-2 text-left transition-colors hover:bg-accent"
    aria-pressed={enabled}
  >
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <span
      className={cn(
        "flex h-6 w-11 items-center rounded-full px-0.5 transition-colors",
        enabled ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-background transition-transform",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </span>
  </button>
);

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
  const cutToolActive = useUIStore((state) => state.cutToolActive);
  const toggleCutTool = useUIStore((state) => state.actions.toggleCutTool);

  const playheadMs = useTransportStore((state) => state.playheadMs);
  const setPlayheadMs = useTransportStore((state) => state.actions.setPlayheadMs);

  const metronomeEnabled = useMetronomeStore((state) => state.enabled);
  const toggleMetronome = useMetronomeStore((state) => state.actions.toggle);

  const undo = useStore(useMidiStore.temporal, (state) => state.undo);
  const redo = useStore(useMidiStore.temporal, (state) => state.redo);
  const canUndo = useStore(useMidiStore.temporal, (state) => state.pastStates.length > 0);
  const canRedo = useStore(useMidiStore.temporal, (state) => state.futureStates.length > 0);

  const loadFromArrayBuffer = useMidiStore((state) => state.actions.loadFromArrayBuffer);
  const exportToMidi = useMidiStore((state) => state.actions.exportToMidi);
  const editingPatternId = usePatternStore((state) => state.editingPatternId);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const formattedTime = formatTimecode(playheadMs);

  const handleStop = () => onStop();
  const handlePlay = () => onPlay();
  const handleMetronomeToggle = () => {
    audioEngine.ensureMetronomeReady();
    toggleMetronome();
  };

  const handleImportMidi = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      await loadFromArrayBuffer(arrayBuffer, {
        mode: "append",
        targetPatternId: editingPatternId ?? undefined,
      });
    } catch (error) {
      console.error("Failed to import MIDI:", error);
    }

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExportMidi = () => {
    if (!editingPatternId) {
      console.warn("No pattern selected for export");
      return;
    }
    exportToMidi(editingPatternId);
  };

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
      label: "Typing keyboard",
      description: "Play notes with QWERTY keys",
      enabled: computerInputEnabled,
      onToggle: () => setComputerInputEnabled(!computerInputEnabled),
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-layer-2/95 text-sm shadow-layer-sm backdrop-blur-sm">
      {/* Hidden file input for MIDI import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="relative flex h-14 items-center justify-between gap-2 px-4">
        {/* LEFT: App Identity Cluster */}
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md shadow-layer-md">
            <img
              src="/tone-logo-white.png"
              alt="Tone"
              className="h-8 w-8 object-contain"
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-foreground">tone</p>
            <p className="text-xs text-muted-foreground">Untitled Project</p>
          </div>
          <Separator orientation="vertical" className="hidden h-8 md:block opacity-30" />
          <div className="hidden items-center gap-0.5 rounded-md border border-border bg-muted/20 px-1 shadow-layer-sm md:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-2 text-xs">
                  File
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem disabled>
                  New Project
                  <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  Open
                  <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  Save
                  <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleImportMidi}>
                  Import MIDI
                  <DropdownMenuShortcut>⌘I</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportMidi}>
                  Export MIDI
                  <DropdownMenuShortcut>⇧⌘E</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-2 text-xs">
                  Edit
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem>
                  Cut
                  <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Copy
                  <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Paste
                  <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => canUndo && undo()} disabled={!canUndo}>
                  Undo
                  <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => canRedo && redo()} disabled={!canRedo}>
                  Redo
                  <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Separator orientation="vertical" className="hidden h-8 opacity-30 lg:block" />
          {/* Mode Switcher Cluster */}
          <div className="hidden items-center gap-0.5 rounded-md border border-border bg-muted/30 p-1 shadow-layer-sm lg:flex">
            {VIEW_OPTIONS.map((option) => {
              const isActive = activeView === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveView(option.id)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-sm px-3 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-background text-foreground shadow-layer-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                  aria-pressed={isActive}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER: Transport Cluster with BPM/Time */}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-1 shadow-layer-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStop}
              className="h-8 w-8"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant={isPlaying ? "default" : "ghost"}
              size="icon"
              onClick={handlePlay}
              className={cn("h-8 w-8", isPlaying && "shadow-layer-sm")}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant={metronomeEnabled ? "secondary" : "ghost"}
              size="icon"
              onClick={handleMetronomeToggle}
              className="h-8 w-8"
              title={metronomeEnabled ? "Metronome on" : "Metronome off"}
            >
              <Music className="h-4 w-4" />
            </Button>
            <Button
              variant={recordArm ? "destructive" : "ghost"}
              size="icon"
              onClick={() => setRecordArm(!recordArm)}
              className={cn("h-8 w-8", recordArm && "shadow-layer-sm")}
              title={recordArm ? "Recording armed" : "Arm recording"}
            >
              <Circle className="h-3.5 w-3.5 fill-current" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            {/* BPM/Time Module */}
            <div className="hidden items-center gap-2 px-2 sm:flex">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                BPM
              </span>
              <Input
                id={tempoInputId}
                type="number"
                value={tempo}
                onChange={(event) => setTempo(Number(event.target.value))}
                className="h-7 w-12 border-0 bg-background px-1.5 py-0.5 text-xs font-semibold shadow-layer-sm focus-visible:ring-1"
              />
              <Separator orientation="vertical" className="h-4" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                TIME
              </span>
              <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-xs font-mono text-foreground shadow-layer-sm">
                {formattedTime}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: Editor Tools & Settings Cluster */}
        <div className="flex items-center gap-2">
          {/* Mobile view switcher */}
          <div className="lg:hidden">
            <Select value={activeView} onValueChange={(value) => setActiveView(value as WorkspaceView)}>
              <SelectTrigger className="h-9 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Follow playhead toggle */}
          <Button
            variant={followPlayhead ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPianoRollFollow(!followPlayhead)}
            className="hidden h-9 px-2.5 text-xs sm:flex"
            title="Follow playhead"
          >
            Follow
          </Button>

          {/* Key/Scale dropdowns */}
          <div className="hidden items-center gap-2 sm:flex">
            <Select value={rootNote} onValueChange={setRootNote}>
              <SelectTrigger id={keySelectId} className="h-9 w-16 text-xs shadow-layer-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getRootNotes().map((note) => (
                  <SelectItem key={note} value={note}>
                    {note}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger id={scaleSelectId} className="h-9 w-20 text-xs shadow-layer-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getScaleNames().map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cut tool */}
          <Button
            variant={cutToolActive ? "default" : "ghost"}
            size="icon"
            onClick={toggleCutTool}
            className={cn("h-9 w-9", cutToolActive && "shadow-layer-sm")}
            title={cutToolActive ? "Cut tool active (Cmd+K)" : "Cut tool (Cmd+K)"}
          >
            <Scissors className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-8 opacity-30" />

          {/* Grid and Zoom */}
          <div className="flex items-center gap-2">
            <Select value={gridResolutionId} onValueChange={setGridResolution}>
              <SelectTrigger className="h-9 w-20 text-xs shadow-layer-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIANO_ROLL.GRID_RESOLUTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <VerticalZoomControl className="h-9" />
          </div>

          <Separator orientation="vertical" className="h-8 opacity-30" />

          <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={settingsOpen ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9"
                title="Session settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                View Settings
              </DropdownMenuLabel>
              <div className="space-y-2 p-1">
                {settingsOptions.map((option) => (
                  <SettingsToggle key={option.label} {...option} />
                ))}
              </div>
              <DropdownMenuSeparator />
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <DropdownMenuLabel className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  Midi
                </DropdownMenuLabel>
                <TopBarMidiControls className="w-full justify-between" />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
