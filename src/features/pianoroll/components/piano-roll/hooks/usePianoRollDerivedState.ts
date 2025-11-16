import { useMemo } from "react";
import { PIANO_ROLL } from "@/core/constants/pianoRoll";
import type { MidiLiveEvent, MidiNoteClip } from "@/core/midi/types";
import { resolveTrackId } from "@/core/utils/trackUtils";
import { generatePianoKeys } from "../lib/coords";

const EXTRA_BEATS = 16;

interface UsePianoRollDerivedStateProps {
  sustainExtendedClips: MidiNoteClip[];
  clipsWithoutSustain: MidiNoteClip[];
  showSustainExtended: boolean;
  showGhostNotes: boolean;
  activeTrackId: string | null;
  editingPatternId: string | null;
  recordingPreviewClips: MidiNoteClip[];
  liveEvents: MidiLiveEvent[];
  tempo: number;
  playheadMs: number;
  gridExtraBeats: number;
  gridResolutionId: string;
  pianoRollZoom: number;
  pianoRollKeyHeight: number;
}

interface UsePianoRollDerivedStateReturn {
  // Piano keys
  pianoKeys: ReturnType<typeof generatePianoKeys>;
  noteToIndex: Map<string, number>;
  activeNotes: Set<number>;

  // Clips
  allClips: MidiNoteClip[];
  activeTrackClips: MidiNoteClip[];
  ghostClips: MidiNoteClip[];
  renderClips: MidiNoteClip[];

  // Timing calculations
  msPerBeat: number;
  pixelsPerBeat: number;
  keyHeight: number;
  notePadding: number;
  subdivisionsPerBeat: number;
  quantizationBeats: number;
  defaultDurationBeats: number;

  // Grid dimensions
  gridWidth: number;
  playheadX: number;
  clampedPlayheadX: number;
}

/**
 * Computes all derived state for the piano roll.
 *
 * This includes:
 * - Piano keys and note mappings
 * - Filtered clips (active track, ghost notes, preview clips)
 * - Timing calculations (ms per beat, pixels per beat)
 * - Grid dimensions
 * - Playhead position
 */
export const usePianoRollDerivedState = ({
  sustainExtendedClips,
  clipsWithoutSustain,
  showSustainExtended,
  showGhostNotes,
  activeTrackId,
  editingPatternId,
  recordingPreviewClips,
  liveEvents,
  tempo,
  playheadMs,
  gridExtraBeats,
  gridResolutionId,
  pianoRollZoom,
  pianoRollKeyHeight,
}: UsePianoRollDerivedStateProps): UsePianoRollDerivedStateReturn => {
  // Piano keys (88 keys from A0 to C8)
  const pianoKeys = useMemo(() => generatePianoKeys(), []);

  // Select clips based on sustain pedal display mode
  const allClips = showSustainExtended ? sustainExtendedClips : clipsWithoutSustain;

  // Filter clips for active track and editing pattern
  const activeTrackClips = useMemo(() => {
    let filtered = allClips;
    
    // First filter by track
    if (activeTrackId) {
      filtered = filtered.filter((clip) => resolveTrackId(clip.trackId) === activeTrackId);
    }
    
    // Then filter by pattern if editing a specific pattern
    // Show clips that belong to this pattern OR clips without patternId (backward compatibility)
    if (editingPatternId) {
      filtered = filtered.filter((clip) => 
        clip.patternId === editingPatternId || !clip.patternId
      );
    }
    // If no editingPatternId, show all clips for the track (normal mode)
    
    return filtered;
  }, [allClips, activeTrackId, editingPatternId]);

  // Ghost notes (notes from inactive tracks)
  const ghostClips = useMemo(() => {
    if (!showGhostNotes) return [] as typeof allClips;
    if (!activeTrackId) return [] as typeof allClips;
    return allClips.filter((clip) => resolveTrackId(clip.trackId) !== activeTrackId);
  }, [allClips, activeTrackId, showGhostNotes]);

  // Combine active track clips with recording preview clips
  const renderClips = useMemo(() => {
    // Filter preview clips for active track and pattern
    let previewClipsForActiveTrack: typeof recordingPreviewClips = [];
    if (activeTrackId && recordingPreviewClips.length > 0) {
      const resolved = resolveTrackId(activeTrackId);
      previewClipsForActiveTrack = recordingPreviewClips.filter((clip) => {
        const matchesTrack = resolveTrackId(clip.trackId) === resolved;
        const matchesPattern = !editingPatternId || clip.patternId === editingPatternId;
        return matchesTrack && matchesPattern;
      });
    }

    // Combine with active track clips
    if (previewClipsForActiveTrack.length === 0) return activeTrackClips;
    return [...activeTrackClips, ...previewClipsForActiveTrack].sort((a, b) => a.start - b.start);
  }, [activeTrackClips, recordingPreviewClips, activeTrackId, editingPatternId]);

  // Timing constants with zoom multipliers
  const msPerBeat = 60000 / Math.max(tempo, 1);
  const pixelsPerBeat = PIANO_ROLL.PIXELS_PER_BEAT * pianoRollZoom;
  const keyHeight = PIANO_ROLL.KEY_HEIGHT * pianoRollKeyHeight;
  const notePadding = PIANO_ROLL.NOTE_PADDING;

  // Grid resolution
  const gridResolution =
    PIANO_ROLL.GRID_RESOLUTIONS.find((option) => option.id === gridResolutionId) ??
    PIANO_ROLL.GRID_RESOLUTIONS.find(
      (option) => option.id === PIANO_ROLL.DEFAULT_GRID_RESOLUTION_ID,
    ) ??
    PIANO_ROLL.GRID_RESOLUTIONS[0];
  const subdivisionsPerBeat = gridResolution.subdivisionsPerBeat;
  const quantizationBeats = 1 / subdivisionsPerBeat;
  const defaultDurationBeats = PIANO_ROLL.DEFAULT_DURATION_BEATS;

  // Calculate grid width based on content
  const clipTotalBeats = useMemo(() => {
    if (activeTrackClips.length === 0) return 8;
    const maxBeat = activeTrackClips.reduce((max, clip) => {
      const clipEndBeats = (clip.start + clip.duration) / msPerBeat;
      return Math.max(max, clipEndBeats);
    }, 0);
    return Math.max(maxBeat, 8);
  }, [activeTrackClips, msPerBeat]);

  const playheadBeats = playheadMs / msPerBeat;
  const playheadBufferBeats = 16;
  const beatsForViewport = Math.max(
    8,
    clipTotalBeats + EXTRA_BEATS,
    Math.ceil(playheadBeats + playheadBufferBeats),
  );

  const gridWidth = useMemo(
    () => Math.max((beatsForViewport + gridExtraBeats) * pixelsPerBeat, PIANO_ROLL.MIN_GRID_WIDTH),
    [beatsForViewport, gridExtraBeats, pixelsPerBeat],
  );

  // Playhead position
  const playheadX = playheadBeats * pixelsPerBeat;
  const clampedPlayheadX = Math.max(0, Math.min(gridWidth, playheadX));

  // Note mappings for quick lookups
  const noteToIndex = useMemo(() => {
    const map = new Map<string, number>();
    pianoKeys.forEach((key, index) => {
      map.set(key.note, index);
    });
    return map;
  }, [pianoKeys]);

  // Active notes from live MIDI input
  const activeNotes = useMemo(() => {
    const set = new Set<number>();
    liveEvents.forEach((event) => {
      if (event.type === "noteon") set.add(event.noteNumber);
      else if (event.type === "noteoff") set.delete(event.noteNumber);
    });
    return set;
  }, [liveEvents]);

  return {
    // Piano keys
    pianoKeys,
    noteToIndex,
    activeNotes,

    // Clips
    allClips,
    activeTrackClips,
    ghostClips,
    renderClips,

    // Timing
    msPerBeat,
    pixelsPerBeat,
    keyHeight,
    notePadding,
    subdivisionsPerBeat,
    quantizationBeats,
    defaultDurationBeats,

    // Grid
    gridWidth,
    playheadX,
    clampedPlayheadX,
  };
};
