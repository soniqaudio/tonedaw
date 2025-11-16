import Soundfont, { Player } from "soundfont-player";

export interface ScheduledPlaybackEvent {
  noteNumber: number;
  velocity: number;
  startTimeSec: number;
  durationSec: number;
  trackId?: string;
}

const velocityToGain = (velocity: number | undefined) => {
  if (velocity == null) return 0.8; // sensible default
  const value = velocity <= 1 ? velocity : velocity / 127;
  const clamped = Math.max(0, Math.min(1, value));
  const MONITOR_GAIN = 1.04;
  return clamped * MONITOR_GAIN;
};

class AudioEngine {
  private instrument: Player | null = null;
  private ac: AudioContext | null = null;
  private activeNotes: Map<string, ReturnType<Player["play"]>> = new Map();
  private masterGain: GainNode | null = null;
  private scheduledEvents: Array<{ stop: (when?: number) => void }> = [];
  private sustainActiveByTrack = new Map<string, boolean>();
  private sustainedNotesByTrack = new Map<string, Set<number>>(); // Track which notes are being sustained
  private metronomeGain: GainNode | null = null;
  private metronomeClickBuffer: AudioBuffer | null = null;
  private metronomeAccentBuffer: AudioBuffer | null = null;
  private scheduledMetronomeSources: Set<AudioBufferSourceNode> = new Set();

  private ensureAudioContext(): AudioContext {
    if (typeof window === "undefined") {
      return {} as AudioContext;
    }
    if (!this.ac) {
      this.ac = new AudioContext();
    }
    return this.ac;
  }

  async resume() {
    const ac = this.ensureAudioContext();
    if (ac.state === "suspended") {
      await ac.resume();
    }

    if (!this.instrument) {
      try {
        if (!this.masterGain) {
          this.masterGain = ac.createGain();
          this.masterGain.gain.value = 0.9;
          this.masterGain.connect(ac.destination);
        }

        this.instrument = await Soundfont.instrument(
          ac,
          "/audio/soundfonts/acoustic_grand_piano-mp3.js",
          {
            destination: this.masterGain,
          },
        );
      } catch (error) {
        console.error("Failed to load soundfont instrument", error);
      }
    }
  }

  getContext(): AudioContext {
    return this.ensureAudioContext();
  }

  stopAll() {
    this.instrument?.stop();
    this.activeNotes.clear();
    this.sustainedNotesByTrack.clear();
    this.scheduledEvents.forEach((event) => {
      try {
        event.stop();
      } catch (error) {
        console.warn("Failed to stop scheduled event", error);
      }
    });
    this.scheduledEvents = [];
    this.stopMetronome();
  }

  cancelScheduled(afterTimeSec?: number) {
    this.scheduledEvents = this.scheduledEvents.filter((event) => {
      try {
        event.stop(afterTimeSec);
      } catch (error) {
        console.warn("Failed to cancel scheduled event", error);
      }
      return false;
    });
  }

  ensureMetronomeReady() {
    const ac = this.ensureAudioContext();

    if (!this.masterGain) {
      this.masterGain = ac.createGain();
      this.masterGain.gain.value = 0.9;
      this.masterGain.connect(ac.destination);
    }

    if (!this.metronomeGain) {
      this.metronomeGain = ac.createGain();
      this.metronomeGain.gain.value = 0.45;
      this.metronomeGain.connect(this.masterGain);
    }

    if (!this.metronomeClickBuffer || !this.metronomeAccentBuffer) {
      this.metronomeClickBuffer = this.createMetronomeBuffer(ac, false);
      this.metronomeAccentBuffer = this.createMetronomeBuffer(ac, true);
    }
  }

  setMetronomeVolume(volume: number) {
    if (!this.metronomeGain) {
      this.ensureMetronomeReady();
    }
    if (this.metronomeGain) {
      const clamped = Math.max(0, Math.min(1, volume));
      this.metronomeGain.gain.value = clamped;
    }
  }

  scheduleMetronomeClick(timeSec: number, accent = false) {
    if (!Number.isFinite(timeSec)) {
      return;
    }

    this.ensureMetronomeReady();
    const ac = this.ensureAudioContext();

    if (!this.metronomeGain || (!this.metronomeClickBuffer && !this.metronomeAccentBuffer)) {
      return;
    }

    const buffer = accent ? this.metronomeAccentBuffer : this.metronomeClickBuffer;
    if (!buffer) {
      return;
    }

    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(this.metronomeGain);
    source.start(timeSec);
    this.scheduledMetronomeSources.add(source);
    source.onended = () => {
      this.scheduledMetronomeSources.delete(source);
      source.disconnect();
    };
  }

  stopMetronome() {
    this.scheduledMetronomeSources.forEach((source) => {
      try {
        source.stop();
      } catch (error) {
        console.warn("Failed to stop metronome source", error);
      }
      source.disconnect();
    });
    this.scheduledMetronomeSources.clear();
  }

  private createMetronomeBuffer(ac: AudioContext, accent: boolean) {
    const durationSec = 0.05;
    const length = Math.max(1, Math.floor(ac.sampleRate * durationSec));
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    const baseFreq = accent ? 2000 : 1400;
    const amplitude = accent ? 1 : 0.8;

    for (let i = 0; i < length; i += 1) {
      const t = i / ac.sampleRate;
      const env = Math.exp(-t * 40);
      data[i] = Math.sin(2 * Math.PI * baseFreq * t) * env * amplitude;
    }

    return buffer;
  }

  noteOn(note: number, velocity: number, trackId?: string) {
    if (!this.instrument) {
      console.warn("Soundfont instrument not loaded, skipping noteOn.");
      return;
    }

    const key = this.composeKey(note, trackId);
    this.noteOff(note, trackId);

    const gain = velocityToGain(velocity);
    const playingNote = this.instrument.play(note, undefined, { gain });
    this.activeNotes.set(key, playingNote);
  }

  noteOff(note: number, trackId?: string) {
    const normalizedTrackId = trackId ?? "default";
    const isSustainActive = this.sustainActiveByTrack.get(normalizedTrackId) ?? false;

    // If sustain pedal is down, mark note as sustained instead of stopping it
    if (isSustainActive) {
      let sustainedNotes = this.sustainedNotesByTrack.get(normalizedTrackId);
      if (!sustainedNotes) {
        sustainedNotes = new Set();
        this.sustainedNotesByTrack.set(normalizedTrackId, sustainedNotes);
      }
      sustainedNotes.add(note);
      return;
    }

    // No sustain active, stop the note immediately
    const key = this.composeKey(note, trackId);
    const playingNote = this.activeNotes.get(key);
    if (playingNote?.stop) {
      playingNote.stop();
      this.activeNotes.delete(key);
    }
  }

  setSustain(trackId: string, active: boolean) {
    const normalizedTrackId = trackId ?? "default";
    const wasActive = this.sustainActiveByTrack.get(normalizedTrackId) ?? false;
    this.sustainActiveByTrack.set(normalizedTrackId, active);

    // When pedal is released, stop all sustained notes
    if (wasActive && !active) {
      const sustainedNotes = this.sustainedNotesByTrack.get(normalizedTrackId);
      if (sustainedNotes && sustainedNotes.size > 0) {
        sustainedNotes.forEach((note) => {
          const key = this.composeKey(note, trackId);
          const playingNote = this.activeNotes.get(key);
          if (playingNote?.stop) {
            playingNote.stop();
            this.activeNotes.delete(key);
          }
        });
        sustainedNotes.clear();
      }
    }
  }

  scheduleEvents(baseTimeSec: number, events: ScheduledPlaybackEvent[]) {
    if (!this.instrument || events.length === 0) {
      return;
    }

    const normalized = events
      .map((event) => {
        const offset = event.startTimeSec - baseTimeSec;
        if (offset < -0.05) {
          return null;
        }
        const entry = {
          time: Math.max(0, offset),
          note: event.noteNumber,
          duration: Math.max(0.001, event.durationSec),
          gain: velocityToGain(event.velocity),
        };
        return entry;
      })
      .filter(
        (event): event is { time: number; note: number; duration: number; gain: number } =>
          event !== null,
      );

    if (normalized.length === 0) {
      return;
    }

    const scheduled = this.instrument.schedule(baseTimeSec, normalized);
    this.scheduledEvents.push(scheduled);
  }

  private composeKey(note: number, trackId?: string) {
    return `${trackId ?? "default"}:${note}`;
  }

  setTrackVolume(_trackId: string, volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  async loadOneshotForTrack(_trackId: string, _audioBlob: Blob, _volume = 0.8) {
    console.warn("Custom per-track samples are not supported in the current audio engine");
  }

  resetTrackToDefault(_trackId: string) {
    // No-op for the simplified soundfont engine.
  }
}

export const audioEngine = new AudioEngine();
