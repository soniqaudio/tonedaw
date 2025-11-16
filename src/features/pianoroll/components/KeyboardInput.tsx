"use client";

import { useCallback, useEffect, useRef } from "react";
import { audioEngine } from "@/core/audio/audioEngine";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { useMusicTheoryStore } from "@/core/stores/useMusicTheoryStore";
import { useTransportStore } from "@/core/stores/useTransportStore";
import { getActiveTrackId } from "@/core/utils/trackUtils";
import { getOrCreateEditingPattern, updatePatternClipLengths } from "@/core/utils/patternUtils";
import { usePatternStore } from "@/core/stores/usePatternStore";
import { useMidiAccess } from "@/features/pianoroll/hooks/useMidiAccess";
import { useMidiRecorder } from "@/features/pianoroll/hooks/useMidiRecorder";
import { useTypingPiano } from "@/features/pianoroll/hooks/useTypingPiano";

export default function KeyboardInput() {
  const {
    state: accessState,
    error: accessError,
    requestAccess,
    midiAccess,
    inputs: accessInputs,
  } = useMidiAccess();
  const {
    setDevices,
    selectInput,
    setMidiAccessState,
    setMidiAccessError,
    beginRecordingPreview,
    endRecordingPreview,
    clearRecordingPreviews,
  } = useMidiStore((state) => state.actions);
  const appendEvents = useMidiStore((state) => state.actions.appendEvents);
  const isRecording = useMidiStore((state) => state.isRecording);
  const recordArm = useMidiStore((state) => state.recordArm);
  const computerInputEnabled = useMidiStore((state) => state.computerInputEnabled);
  const playheadMs = useTransportStore((state) => state.playheadMs);
  const isPlaying = useTransportStore((state) => state.isPlaying);
  const rootNote = useMusicTheoryStore((state) => state.rootNote);
  const scale = useMusicTheoryStore((state) => state.scale);
  const selectedInputId = useMidiStore((state) => state.selectedInputId);
  const midiAccessRequestToken = useMidiStore((state) => state.midiAccessRequestToken);

  // Get the selected MIDI input device
  const selectedInput =
    midiAccess && selectedInputId ? (midiAccess.inputs.get(selectedInputId) ?? null) : null;

  // MIDI recorder
  const handlePreviewNoteOn = useCallback(
    ({
      noteId,
      noteNumber,
      velocity,
      timestampMs,
      channel,
    }: {
      noteId: string;
      noteNumber: number;
      velocity: number;
      timestampMs: number;
      channel: number;
    }) => {
      const trackId = getActiveTrackId();
      const patternId = getOrCreateEditingPattern();
      beginRecordingPreview({
        noteId,
        noteNumber,
        startMs: Math.max(0, Math.round(timestampMs)),
        velocity,
        channel,
        trackId,
        patternId,
      });
    },
    [beginRecordingPreview],
  );

  const handlePreviewNoteOff = useCallback(
    ({ noteId }: { noteId: string }) => {
      endRecordingPreview(noteId);
    },
    [endRecordingPreview],
  );

  const recorder = useMidiRecorder(selectedInput, {
    enabled: recordArm,
    onNoteOn: handlePreviewNoteOn,
    onNoteOff: handlePreviewNoteOff,
  });
  const lastEventCountRef = useRef(0);

  // Computer keyboard piano
  useTypingPiano(
    computerInputEnabled,
    (event) => {
      // Always play the note
      const trackId = getActiveTrackId();
      if (event.type === "on") {
        audioEngine.resume().catch(() => undefined);
        audioEngine.noteOn(event.note, event.velocity, trackId);
      } else {
        audioEngine.noteOff(event.note, trackId);
      }

      // If recording, also push to recorder
      if (recordArm) {
        recorder.push(event);
      }
    },
    96, // velocity
    rootNote,
    scale,
  );

  // Mirror MIDI access status into store for UI consumption
  useEffect(() => {
    setMidiAccessState(accessState);
  }, [accessState, setMidiAccessState]);

  useEffect(() => {
    setMidiAccessError(accessError);
  }, [accessError, setMidiAccessError]);

  useEffect(() => {
    if (accessState === "granted" || accessState === "requesting" || accessState === "initial") {
      setMidiAccessError(undefined);
    }
  }, [accessState, setMidiAccessError]);

  // Update devices in store
  useEffect(() => {
    setDevices(accessInputs);
  }, [accessInputs, setDevices]);

  // Auto-select first input when available
  useEffect(() => {
    if (!midiAccess) return;
    if (accessInputs.length === 0) {
      selectInput(undefined);
      return;
    }
    if (!selectedInputId || !accessInputs.some((device) => device.id === selectedInputId)) {
      selectInput(accessInputs[0]?.id);
    }
  }, [accessInputs, midiAccess, selectInput, selectedInputId]);

  // Respond to connection requests triggered from the UI
  const lastRequestRef = useRef<number>(0);
  useEffect(() => {
    if (midiAccessRequestToken === 0) return;
    if (midiAccessRequestToken === lastRequestRef.current) return;
    lastRequestRef.current = midiAccessRequestToken;

    setMidiAccessState("requesting");
    void requestAccess().catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to request MIDI access";
      setMidiAccessError(message);
      setMidiAccessState(message.includes("permission") ? "denied" : "error");
    });
  }, [midiAccessRequestToken, requestAccess, setMidiAccessError, setMidiAccessState]);

  // Handle live MIDI input (audio playback for all notes)
  useEffect(() => {
    if (!selectedInput) return;

    void (async () => {
      try {
        await selectedInput.open();
        setMidiAccessState("granted");
        setMidiAccessError(undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to open MIDI input";
        setMidiAccessError(message);
        setMidiAccessState("error");
      }
    })();

    const handleMidiMessage = (event: MIDIMessageEvent) => {
      const dataArray = event.data || new Uint8Array([0, 0, 0]);
      const [status, data1, data2] = dataArray;
      if (status == null || data1 == null) return;

      const command = status & 0xf0;
      const controllerOrNote = data1;
      const velocity = data2 ?? 0;
      const activeTrackId = getActiveTrackId();

      if (command === 0xb0) {
        if (controllerOrNote === 64) {
          const sustainActive = velocity >= 64;
          audioEngine.setSustain(activeTrackId, sustainActive);
        }
        return;
      }

      if (command === 0x90 && velocity > 0) {
        const noteNumber = controllerOrNote;
        audioEngine.resume().catch(() => undefined);
        audioEngine.noteOn(noteNumber, velocity, activeTrackId);
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        const noteNumber = controllerOrNote;
        audioEngine.noteOff(noteNumber, activeTrackId);
      }
    };

    // Some browsers only fire via onmidimessage; wire both for safety
    selectedInput.onmidimessage = handleMidiMessage as unknown as (
      this: MIDIInput,
      ev: MIDIMessageEvent,
    ) => void;
    selectedInput.addEventListener("midimessage", handleMidiMessage);

    return () => {
      selectedInput.onmidimessage = null;
      selectedInput.removeEventListener("midimessage", handleMidiMessage);
    };
  }, [selectedInput, setMidiAccessError, setMidiAccessState]);

  // Handle recording state changes
  useEffect(() => {
    const midiActions = useMidiStore.getState().actions;

    if (recordArm && isPlaying && !isRecording) {
      const startMs = playheadMs;
      clearRecordingPreviews();
      recorder.start(startMs);
      lastEventCountRef.current = 0;
      midiActions.setRecording(true);
    } else if (isRecording && (!recordArm || !isPlaying)) {
      recorder.stop();
      recorder.clear();
      lastEventCountRef.current = 0;
      midiActions.setRecording(false);
      clearRecordingPreviews();
      
      // Update pattern clip length after recording finishes
      // Use setTimeout to ensure recorded notes have been processed
      const editingPatternId = usePatternStore.getState().editingPatternId;
      if (editingPatternId) {
        setTimeout(() => {
          updatePatternClipLengths(editingPatternId);
        }, 100); // Slightly longer delay for recording to ensure all events are processed
      }
    }
  }, [recordArm, isRecording, isPlaying, playheadMs, recorder, clearRecordingPreviews]);

  // Live recording - append new events as they happen
  useEffect(() => {
    if (!isRecording) return;

    const currentEvents = recorder.state.events;
    const currentCount = currentEvents.length;

    if (currentCount > lastEventCountRef.current) {
      // Get only the new events since last update
      const newEvents = currentEvents.slice(lastEventCountRef.current);
      const trackId = getActiveTrackId();
      appendEvents(newEvents, trackId);
      lastEventCountRef.current = currentCount;
    }
  }, [recorder.state.events, isRecording, appendEvents]);

  return null; // This is a logic-only component
}
