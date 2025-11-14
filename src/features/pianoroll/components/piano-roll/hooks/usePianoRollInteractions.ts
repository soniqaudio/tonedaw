"use client";

import { type PointerEvent as ReactPointerEvent, useCallback, useRef } from "react";
import type { MidiNoteClip } from "@/core/midi/types";
import { useMidiStore } from "@/core/stores/useMidiStore";
import { useUIStore } from "@/core/stores/useUIStore";
import { useNoteMovement } from "../interactions/noteMovement";
import { useCursorManagement } from "../interactions/useCursorManagement";
import { useMarqueeSelection } from "../interactions/useMarqueeSelection";
import { useNoteCreation } from "../interactions/useNoteCreation";
import { useNoteDeletion } from "../interactions/useNoteDeletion";
import { useNoteResize } from "../interactions/useNoteResize";
import { useTimelineScrub } from "../interactions/useTimelineScrub";
import { useViewportNavigation } from "../interactions/useViewportNavigation";
import { clientToLocalRect } from "../lib/coords";

type InteractionMode = "idle" | "scrub" | "resizing" | "marquee" | "moving";

interface UsePianoRollInteractionsProps {
  pianoKeys: Array<{ note: string; isBlack: boolean; midi: number }>;
  clips: MidiNoteClip[];
  ghostClips: MidiNoteClip[];
  addClip: (clip: MidiNoteClip) => void;
  removeClip: (clipId: string) => void;
  updateClipDuration: (clipId: string, newDuration: number) => void;
  updateClips: (
    updates: Array<{
      id: string;
      start: number;
      noteNumber: number;
    }>,
  ) => void;
  setSelectedClipIds: (ids: string[]) => void;
  selectedClipIds: string[]; // Add this to know which clips are selected
  pixelsPerBeat: number;
  msPerBeat: number;
  keyHeight: number;
  quantizationBeats: number;
  defaultDurationBeats: number;
  gridWidth: number;
  setPlayheadMs: (ms: number) => void;
  isPlaying: boolean;
  pause: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollLeft: number;
  noteToIndex: Map<string, number>;
  viewportWidth: number;
  activateTrack: (trackId: string) => void;
}

export const usePianoRollInteractions = ({
  pianoKeys,
  clips,
  ghostClips,
  addClip,
  removeClip,
  updateClipDuration,
  updateClips,
  setSelectedClipIds,
  selectedClipIds,
  pixelsPerBeat,
  msPerBeat,
  keyHeight,
  quantizationBeats,
  defaultDurationBeats,
  gridWidth,
  setPlayheadMs,
  isPlaying,
  pause,
  containerRef,
  gridContainerRef,
  timelineContainerRef,
  scrollLeft,
  noteToIndex,
  viewportWidth,
  activateTrack,
}: UsePianoRollInteractionsProps) => {
  const modeRef = useRef<InteractionMode>("idle");
  const lastRightClickRef = useRef<{ time: number; clipId: string | null }>({
    time: 0,
    clipId: null,
  });

  // Helper to get clip rectangle in pixels
  const getClipRectPx = useCallback(
    (clip: MidiNoteClip) => {
      const keyIdx = noteToIndex.get(clip.noteName);
      if (keyIdx === undefined) return null;
      const left = (clip.start / msPerBeat) * pixelsPerBeat;
      const right = ((clip.start + clip.duration) / msPerBeat) * pixelsPerBeat;
      const top = keyIdx * keyHeight;
      const bottom = top + keyHeight;
      return { left, right, top, bottom };
    },
    [noteToIndex, msPerBeat, pixelsPerBeat, keyHeight],
  );

  const isNearRightEdge = useCallback(
    (worldX: number, clipRect: { left: number; right: number }) => {
      const distanceToRightEdge = Math.abs(worldX - clipRect.right);
      return distanceToRightEdge <= 8 && worldX >= clipRect.left && worldX <= clipRect.right + 8;
    },
    [],
  );

  // Use extracted hooks
  const { tryBeginMove, isMoving, cancelMove } = useNoteMovement({
    keyHeight,
    msPerBeat,
    pixelsPerBeat,
    containerRef,
    gridContainerRef,
    updateClips,
  });

  const { findRightEdgeHit, startResize, isResizing, cancelResize } = useNoteResize({
    clips,
    selectedClipIds,
    gridContainerRef,
    containerRef,
    scrollLeft,
    pixelsPerBeat,
    msPerBeat,
    quantizationBeats,
    updateClipDuration,
    getClipRectPx,
    isNearRightEdge,
    onResizeStart: () => {
      modeRef.current = "resizing";
    },
    onResizeEnd: () => {
      modeRef.current = "idle";
    },
  });

  const { startMarquee, selectionRect, isMarqueeActive, cancelMarquee } = useMarqueeSelection({
    clips,
    gridContainerRef,
    containerRef,
    scrollLeft,
    pixelsPerBeat,
    msPerBeat,
    keyHeight,
    noteToIndex,
    setSelectedClipIds,
    onMarqueeStart: () => {
      modeRef.current = "marquee";
    },
    onMarqueeEnd: () => {
      modeRef.current = "idle";
    },
  });

  const { createNoteAt } = useNoteCreation({
    pianoKeys,
    addClip,
    msPerBeat,
    quantizationBeats,
    defaultDurationBeats,
  });

  const { deleteNoteAt } = useNoteDeletion({
    clips,
    removeClip,
    pianoKeys,
  });

  const { startScrub, isScrubbing } = useTimelineScrub({
    gridContainerRef,
    timelineContainerRef,
    containerRef,
    gridWidth,
    pixelsPerBeat,
    msPerBeat,
    setPlayheadMs,
    isPlaying,
    pause,
    scrollLeft,
    onScrubStart: () => {
      modeRef.current = "scrub";
    },
    onScrubEnd: () => {
      modeRef.current = "idle";
    },
  });

  const { handleViewportDragStart } = useViewportNavigation({
    timelineContainerRef,
    containerRef,
    gridWidth,
    viewportWidth,
  });

  const findClipBodyHitInList = useCallback(
    (targetClips: MidiNoteClip[], worldX: number, worldY: number) => {
      for (let i = targetClips.length - 1; i >= 0; i--) {
        const rect = getClipRectPx(targetClips[i]);
        if (!rect) continue;
        if (
          worldX >= rect.left &&
          worldX <= rect.right &&
          worldY >= rect.top &&
          worldY <= rect.bottom
        ) {
          return targetClips[i];
        }
      }
      return null;
    },
    [getClipRectPx],
  );

  const findClipBodyHit = useCallback(
    (worldX: number, worldY: number) => {
      return findClipBodyHitInList(clips, worldX, worldY);
    },
    [clips, findClipBodyHitInList],
  );

  const { handleGridPointerMove: updateCursor } = useCursorManagement({
    containerRef,
    worldToMs: (worldX: number) => Math.max(0, (worldX / pixelsPerBeat) * msPerBeat),
    worldToNoteNumber: (worldY: number) => {
      const pointerIndex = Math.max(
        0,
        Math.min(pianoKeys.length - 1, Math.floor(worldY / keyHeight)),
      );
      return pianoKeys[pointerIndex]?.midi ?? 60;
    },
    findRightEdgeHit,
    findClipBodyHit,
    isIdle: () => modeRef.current === "idle",
  });

  const findAnyClipBodyHit = useCallback(
    (worldX: number, worldY: number) => {
      const activeHit = findClipBodyHit(worldX, worldY);
      if (activeHit) return activeHit;
      return findClipBodyHitInList(ghostClips, worldX, worldY);
    },
    [findClipBodyHit, findClipBodyHitInList, ghostClips],
  );

  // Grid pointer down handler
  const handleGridPointerDown = useCallback(
    async (event: ReactPointerEvent<HTMLDivElement>) => {
      const gridRect = gridContainerRef.current?.getBoundingClientRect();
      if (!gridRect) return;

      // Get local coordinates relative to the viewport
      const { localX, localY } = clientToLocalRect(event.clientX, event.clientY, gridRect);

      // Convert viewport coordinates to world coordinates by adding scrollLeft
      const currentScrollLeft = containerRef.current?.scrollLeft ?? scrollLeft;
      const worldX = localX + currentScrollLeft;
      const worldY = localY;

      // Clamp to grid bounds
      const pointerX = Math.max(0, Math.min(gridWidth, worldX));
      const pointerY = Math.max(0, worldY);

      const pointerBeats = pointerX / pixelsPerBeat;
      const pointerMs = pointerBeats * msPerBeat;
      const noteIndex = Math.floor(pointerY / keyHeight);
      const clampedNoteIndex = Math.max(0, Math.min(pianoKeys.length - 1, noteIndex));
      const pianoKey = pianoKeys[clampedNoteIndex];

      useUIStore.getState().actions.setPianoRollPointer({
        ms: Math.max(0, pointerMs),
        noteNumber: pianoKey?.midi ?? 60,
      });

      const bodyHit = findClipBodyHit(worldX, worldY);
      const cutToolActive = useUIStore.getState().cutToolActive;

      // Cut tool: split note at cursor position (only when cut tool is active and not using modifiers)
      if (cutToolActive && bodyHit && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        const actions = useMidiStore.getState().actions;
        actions.splitClipAt(bodyHit.id, pointerMs);
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();

        if (bodyHit) {
          // If clicking on an unselected clip, add it to selection
          if (!selectedClipIds.includes(bodyHit.id)) {
            const next = [...selectedClipIds, bodyHit.id];
            setSelectedClipIds(next);
            return;
          }
          // If clicking on an already-selected clip, allow proceeding to movement
          // (don't deselect it here - that would prevent moving the selection)
          // Fall through to normal click handling below
        } else {
          // Clicking on empty space with cmd/ctrl starts marquee selection
          startMarquee(worldX, worldY);
          return;
        }
      }

      // Check for resize handle hit (left button near right edge)
      if (event.button === 0) {
        const edgeHit = findRightEdgeHit(worldX, worldY);
        if (edgeHit) {
          event.preventDefault();
          event.stopPropagation();
          startResize(event, edgeHit.clip);
          return;
        }
      }

      if (event.button === 2) {
        event.preventDefault();

        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const targetClipAny = findAnyClipBodyHit(worldX, worldY);
        const isDoubleRightClick =
          !!targetClipAny &&
          lastRightClickRef.current.clipId === targetClipAny.id &&
          now - lastRightClickRef.current.time < 320;

        if (isDoubleRightClick) {
          activateTrack(targetClipAny.trackId);
          setSelectedClipIds([targetClipAny.id]);
          lastRightClickRef.current = { time: 0, clipId: null };
          return;
        }

        lastRightClickRef.current = { time: now, clipId: targetClipAny?.id ?? null };

        if (event.shiftKey) {
          if (targetClipAny) {
            activateTrack(targetClipAny.trackId);
            setSelectedClipIds([targetClipAny.id]);
          }
          return;
        }

        deleteNoteAt(pointerMs, noteIndex);
        return;
      }

      if (event.button === 0 && bodyHit) {
        event.preventDefault();
        event.stopPropagation();

        const nextSelection = selectedClipIds.includes(bodyHit.id) ? selectedClipIds : [bodyHit.id];

        if (!selectedClipIds.includes(bodyHit.id)) {
          setSelectedClipIds(nextSelection);
        }

        const beganMove = tryBeginMove({
          event,
          bodyClip: bodyHit,
          clips,
          selectedClipIds: nextSelection,
          pointerWorldX: worldX,
          clampedNoteIndex,
        });

        if (beganMove) {
          modeRef.current = "moving";
          return;
        }
      }

      if (event.button !== 0) return;

      event.preventDefault();

      // Skip creating a new note if one already exists under the cursor
      if (bodyHit) {
        return;
      }

      if (selectedClipIds.length > 0) {
        setSelectedClipIds([]);
      }

      createNoteAt(pointerMs, noteIndex);
    },
    [
      gridContainerRef,
      scrollLeft,
      containerRef,
      gridWidth,
      pixelsPerBeat,
      msPerBeat,
      keyHeight,
      findRightEdgeHit,
      findClipBodyHit,
      findAnyClipBodyHit,
      setSelectedClipIds,
      selectedClipIds,
      tryBeginMove,
      activateTrack,
      startMarquee,
      startResize,
      createNoteAt,
      deleteNoteAt,
      clips,
      pianoKeys,
    ],
  );

  // Handle pointer move for cursor changes
  const handleGridPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gridRect = gridContainerRef.current?.getBoundingClientRect();
      if (!gridRect) return;

      const { localX, localY } = clientToLocalRect(event.clientX, event.clientY, gridRect);

      const currentScrollLeft = containerRef.current?.scrollLeft ?? scrollLeft;
      const worldX = localX + currentScrollLeft;
      const worldY = localY;

      updateCursor(worldX, worldY);
    },
    [gridContainerRef, scrollLeft, containerRef, updateCursor],
  );

  return {
    handleTimelinePointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      startScrub(e.clientX, "timeline");
    },
    handleViewportDragStart,
    handleGridPointerDown,
    handleGridPointerMove,
    selectionRect,
  };
};
