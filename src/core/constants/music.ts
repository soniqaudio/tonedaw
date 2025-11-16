/**
 * Music Theory & MIDI Constants
 *
 * Constants related to music theory, tempo, and MIDI specifications.
 */

export const MUSIC = {
  // Tempo constraints
  MIN_TEMPO: 20,
  MAX_TEMPO: 300,
  DEFAULT_TEMPO: 120,

  // MIDI specifications
  MIDI: {
    MIN_NOTE: 0,
    MAX_NOTE: 127,
    MIN_VELOCITY: 0,
    MAX_VELOCITY: 127,
    MIN_CC_VALUE: 0,
    MAX_CC_VALUE: 127,
  },

  // Default values
  DEFAULT_VELOCITY: 100, // Default velocity for created notes (0-127 MIDI range, 100 ~= 78%)
  DEFAULT_ROOT_NOTE: "C",
  DEFAULT_SCALE: "major" as const,
} as const;

// Helper functions for MIDI
export const midiHelpers = {
  clampNote: (note: number) => Math.max(MUSIC.MIDI.MIN_NOTE, Math.min(MUSIC.MIDI.MAX_NOTE, note)),
  clampVelocity: (velocity: number) =>
    Math.max(MUSIC.MIDI.MIN_VELOCITY, Math.min(MUSIC.MIDI.MAX_VELOCITY, velocity)),
  clampCC: (value: number) =>
    Math.max(MUSIC.MIDI.MIN_CC_VALUE, Math.min(MUSIC.MIDI.MAX_CC_VALUE, value)),
  clampTempo: (tempo: number) =>
    Math.max(MUSIC.MIN_TEMPO, Math.min(MUSIC.MAX_TEMPO, Math.round(tempo))),
} as const;
