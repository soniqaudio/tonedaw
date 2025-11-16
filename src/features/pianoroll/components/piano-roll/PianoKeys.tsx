"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { audioEngine } from "@/core/audio/audioEngine";
import { getActiveTrackId } from "@/core/utils/trackUtils";
import type { MidiNoteClip } from "@/core/midi/types";

interface PianoKeysProps {
  pianoKeys: Array<{ note: string; isBlack: boolean; midi: number }>;
  keyHeight: number;
  activeNotes?: Set<number>;
  clips?: MidiNoteClip[];
  playheadMs?: number | null;
}

export const PianoKeys = ({
  pianoKeys,
  keyHeight,
  activeNotes,
  clips = [],
  playheadMs,
}: PianoKeysProps) => {
  const timeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const [clickedKeys, setClickedKeys] = useState<Set<number>>(new Set());

  // Calculate which notes are currently playing based on playhead position
  const playheadActiveNotes = useMemo(() => {
    const set = new Set<number>();
    if (playheadMs == null || clips.length === 0) return set;

    const toleranceMs = 8; // same tolerance as DynamicOverlay

    for (const clip of clips) {
      const clipStart = clip.start;
      const clipEnd = clip.start + clip.duration;
      if (playheadMs + toleranceMs >= clipStart && playheadMs - toleranceMs <= clipEnd) {
        set.add(clip.noteNumber);
      }
    }

    return set;
  }, [clips, playheadMs]);

  const handleKeyClick = useCallback((midiNote: number) => {
    const trackId = getActiveTrackId();

    // Clear any existing timeout for this note
    const existingTimeout = timeoutRefs.current.get(midiNote);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      audioEngine.noteOff(midiNote, trackId);
      timeoutRefs.current.delete(midiNote);
    }

    // Add to clicked keys set for visual highlight
    setClickedKeys((prev) => new Set(prev).add(midiNote));

    // Play audio
    audioEngine.resume().catch(() => undefined);
    audioEngine.noteOn(midiNote, 80, trackId);

    // Release note after short duration
    const timeout = setTimeout(() => {
      audioEngine.noteOff(midiNote, trackId);
      timeoutRefs.current.delete(midiNote);
      // Remove from clicked keys set
      setClickedKeys((prev) => {
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });
    }, 300);

    timeoutRefs.current.set(midiNote, timeout);
  }, []);
  return (
    <div className="w-20 border-r border-subtle bg-layer-2/90 backdrop-blur">
      <div className="relative" style={{ height: `${pianoKeys.length * keyHeight}px` }}>
        {pianoKeys.map((key, index) => {
          // Key is active if played live, clicked, or under the playhead
          const isActive =
            activeNotes?.has(key.midi) ||
            clickedKeys.has(key.midi) ||
            playheadActiveNotes.has(key.midi);
          const baseClasses = `absolute flex w-full items-center justify-end pr-3 uppercase transition-fast`;
          const toneClasses = key.isBlack
            ? "bg-[linear-gradient(90deg,rgba(0,0,0,0.65),rgba(0,0,0,0.25))] text-[hsla(0,0%,85%,0.9)] border-b border-medium"
            : "bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(222,222,222,0.55))] text-[rgba(34,34,34,0.85)] border-b border-subtle";
          const stateClasses = isActive
            ? "bg-[rgba(99,102,241,0.7)] text-white shadow-glow-primary"
            : "hover:bg-surface-hover";
          return (
            <div
              key={key.midi}
              className={`${baseClasses} ${toneClasses} ${stateClasses} cursor-pointer`}
              style={{ top: `${index * keyHeight}px`, height: `${keyHeight}px` }}
              onClick={() => handleKeyClick(key.midi)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className="select-none text-[10px] font-medium mix-blend-normal">
                {key.note}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
