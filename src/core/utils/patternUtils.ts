/**
 * Utility functions for pattern management
 */

import { usePatternStore } from "@/core/stores/usePatternStore";
import { useTrackStore } from "@/core/stores/useTrackStore";
import { usePlaylistStore } from "@/core/stores/usePlaylistStore";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { useMusicTheoryStore } from "@/core/stores/useMusicTheoryStore";
import { getActiveTrackId } from "./trackUtils";

/**
 * Calculates the length of a pattern in bars based on its MIDI content.
 * Returns the length rounded up to the nearest bar, with a minimum of 1 bar.
 */
export const calculatePatternLength = (patternId: string): number => {
  const clips = useMidiStore.getState().clips;
  const tempo = useMusicTheoryStore.getState().tempo;
  
  // Filter clips belonging to this pattern
  const patternClips = clips.filter((clip) => clip.patternId === patternId);
  
  if (patternClips.length === 0) {
    return 1; // Default 1 bar for empty patterns
  }
  
  // Find the end time of the last note
  const maxEndMs = Math.max(
    ...patternClips.map((clip) => clip.start + clip.duration)
  );
  
  // Convert ms to bars (4 beats per bar)
  const msPerBeat = (60 / tempo) * 1000;
  const msPerBar = msPerBeat * 4;
  const bars = maxEndMs / msPerBar;
  
  // Round up to nearest bar, minimum 1 bar
  return Math.max(1, Math.ceil(bars));
};

/**
 * Gets or creates a track for a new pattern.
 * FL Studio-style: Each pattern gets its own track row.
 * Returns the track ID to use.
 */
export const getOrCreateTrackForPattern = (): string => {
  const { tracks, actions: trackActions } = useTrackStore.getState();
  const { patterns } = usePatternStore.getState();
  
  // Count how many patterns we have (to determine track name)
  const patternCount = patterns.length + 1;
  
  // Check if we need a new track
  // If we have fewer tracks than patterns, create a new one
  if (tracks.length < patternCount) {
    const trackName = `Track ${patternCount}`;
    const trackId = trackActions.addTrack(trackName);
    trackActions.setActiveTrack(trackId);
    return trackId;
  }
  
  // Use the track corresponding to this pattern number
  // Pattern 1 → Track 1, Pattern 2 → Track 2, etc.
  const trackIndex = patternCount - 1;
  const track = tracks[trackIndex];
  if (track) {
    trackActions.setActiveTrack(track.id);
    return track.id;
  }
  
  // Fallback: use active track
  return getActiveTrackId();
};

/**
 * Updates the length of all playlist clips that reference a given pattern
 * based on the pattern's current MIDI content.
 * This should be called whenever MIDI notes are added/removed/modified.
 */
export const updatePatternClipLengths = (patternId: string): void => {
  const { clips, actions } = usePlaylistStore.getState();
  const newLength = calculatePatternLength(patternId);
  
  // Find all playlist clips that reference this pattern
  const patternClips = clips.filter((clip) => clip.patternId === patternId);
  
  // Update each clip's length
  patternClips.forEach((clip) => {
    if (clip.length !== newLength) {
      actions.updateClip(clip.id, { length: newLength });
    }
  });
};

/**
 * Gets the editing pattern ID for the active track, or creates one if none exists.
 * This ensures that when creating notes, they're always associated with a pattern.
 * 
 * **FL Studio-style workflow:**
 * - Creates Pattern (metadata + MIDI container)
 * - Creates Playlist Clip (arrangement instance that references the pattern)
 * - Sets pattern as currently editing
 * 
 * @returns The editing pattern ID for the active track
 */
export const getOrCreateEditingPattern = (): string => {
  const { editingPatternId, patterns, actions: patternActions } = usePatternStore.getState();
  const activeTrackId = getActiveTrackId();

  // If there's already an editing pattern, return it
  if (editingPatternId) {
    const editingPattern = patternActions.getPattern(editingPatternId);
    if (editingPattern) {
      return editingPatternId;
    }
  }

  // Default: Use Pattern 1 (always exists)
  const pattern1 = patterns.find((p) => p.id === "pattern-default-1");
  if (pattern1) {
    patternActions.setEditingPattern(pattern1.id);
    return pattern1.id;
  }

  // Fallback: Use first pattern if Pattern 1 doesn't exist
  if (patterns.length > 0) {
    const firstPattern = patterns[0];
    patternActions.setEditingPattern(firstPattern.id);
    return firstPattern.id;
  }

  // Should never reach here since Pattern 1 is initialized
  return "";
};

