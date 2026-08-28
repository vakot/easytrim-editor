import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";

import { clampPlaybackMicros, frameDurationMicros } from "@/domain/playback";
import {
  advanceDirectionalSnapLatch,
  clampToTrim,
  createDirectionalSnapLatch,
  type DirectionalSnapLatch,
  microsFromTimelinePosition,
  moveTrimBoundary,
  moveTrimRange,
  type SegmentSnapPoint,
  settleDirectionalSnapLatch,
  snapMovedTrimRangeToPlayhead,
  type TrimBoundary,
  type TrimRange,
} from "@/domain/trim";
import { snapToNearestPoint } from "@/lib/interaction/snap-points";
import type { FrameRate } from "@/lib/tauri/media";

import { syncTimelineGeometry } from "../lib/timeline-geometry";

const TIMELINE_SNAP_REACH_PX = 12;

interface TrimTimelineInteractionOptions {
  range: TrimRange;
  playheadMicros: number;
  frameRate?: FrameRate;
  onChange: (boundary: TrimBoundary, range: TrimRange) => TrimBoundary | null;
  onMoveSegment: (range: TrimRange) => TrimBoundary | null;
  onTrimDragStart: () => void;
  onTrimDragEnd: () => void;
  onSegmentDragStart: () => void;
  onSegmentDragEnd: () => void;
  onSeek: (micros: number) => void;
  onScrubStart: () => void;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
}

interface TrimDragState {
  boundary: TrimBoundary;
  snapActive: boolean;
}

export function useTrimTimelineInteractions({
  range,
  playheadMicros,
  frameRate,
  onChange,
  onMoveSegment,
  onTrimDragStart,
  onTrimDragEnd,
  onSegmentDragStart,
  onSegmentDragEnd,
  onSeek,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: TrimTimelineInteractionOptions) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubPointerIdRef = useRef<number | null>(null);
  const trimDragRef = useRef<{
    pointerId: number;
    boundary: TrimBoundary;
    lastPointerMicros: number;
    snapLatch: DirectionalSnapLatch;
  } | null>(null);
  const segmentDragRef = useRef<{
    pointerId: number;
    grabOffsetMicros: number;
    lastPointerMicros: number;
    snapModifierActive: boolean;
    snapLatch: DirectionalSnapLatch;
  } | null>(null);
  const rangeRef = useRef(range);
  const [segmentDragging, setSegmentDragging] = useState(false);
  const [segmentSnapPoint, setSegmentSnapPoint] = useState<SegmentSnapPoint | null>(null);
  const [trimDragState, setTrimDragState] = useState<TrimDragState | null>(null);

  useEffect(() => {
    if (!trimDragRef.current && !segmentDragRef.current) {
      rangeRef.current = range;
    }
  }, [range]);

  function syncRange(nextRange: TrimRange) {
    rangeRef.current = nextRange;
    syncTimelineGeometry(
      trackRef.current?.closest<HTMLElement>("[data-slot='timeline-pane']") ?? null,
      nextRange,
    );
  }

  function pointerMicros(clientX: number) {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) {
      return null;
    }
    const currentRange = rangeRef.current;
    return {
      bounds,
      micros: microsFromTimelinePosition(
        clientX,
        bounds.left,
        bounds.width,
        currentRange.sourceDurationMicros,
      ),
    };
  }

  function isNearPlayhead(clientX: number, bounds: DOMRect) {
    const currentRange = rangeRef.current;
    if (bounds.width <= 0 || currentRange.sourceDurationMicros <= 0) {
      return false;
    }
    const clampedPlayhead = clampPlaybackMicros(playheadMicros, currentRange.sourceDurationMicros);
    const playheadX =
      bounds.left + (clampedPlayhead / currentRange.sourceDurationMicros) * bounds.width;
    return snapToNearestPoint(clientX, [playheadX], TIMELINE_SNAP_REACH_PX) !== null;
  }

  function updateTrimFromPointer(
    boundary: TrimBoundary,
    clientX: number,
    snapToPlayhead: boolean,
  ): boolean {
    const pointer = pointerMicros(clientX);
    const drag = trimDragRef.current;
    if (!pointer || !drag || drag.boundary !== boundary) {
      return false;
    }
    const snapState = advanceDirectionalSnapLatch(
      drag.snapLatch,
      pointer.micros - drag.lastPointerMicros,
    );
    drag.lastPointerMicros = pointer.micros;
    drag.snapLatch = snapState.latch;
    const snapActive =
      snapToPlayhead && !snapState.anchorIgnored && isNearPlayhead(clientX, pointer.bounds);
    const next = moveTrimBoundary(
      rangeRef.current,
      boundary,
      snapActive ? playheadMicros : pointer.micros,
    );
    syncRange(next);
    const followedBoundary = onChange(boundary, next);
    drag.snapLatch = settleDirectionalSnapLatch(
      drag.snapLatch,
      snapActive,
      followedBoundary === boundary,
    );
    return snapActive;
  }

  function handleTrimPointer(
    boundary: TrimBoundary,
    event: PointerEvent<HTMLButtonElement>,
    capture: boolean,
  ) {
    if (capture) {
      trimDragRef.current = {
        pointerId: event.pointerId,
        boundary,
        lastPointerMicros: boundaryValue(rangeRef.current, boundary),
        snapLatch: createDirectionalSnapLatch(),
      };
      onTrimDragStart();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } else if (
      trimDragRef.current?.pointerId !== event.pointerId ||
      (event.currentTarget.hasPointerCapture &&
        !event.currentTarget.hasPointerCapture(event.pointerId))
    ) {
      return;
    }
    const snapActive = updateTrimFromPointer(boundary, event.clientX, event.shiftKey);
    setTrimDragState((current) =>
      current?.boundary === boundary && current.snapActive === snapActive
        ? current
        : { boundary, snapActive },
    );
  }

  function finishTrimDrag(boundary: TrimBoundary) {
    const wasActive = trimDragRef.current?.boundary === boundary;
    if (trimDragRef.current?.boundary === boundary) {
      trimDragRef.current = null;
    }
    setTrimDragState((current) => (current?.boundary === boundary ? null : current));
    if (wasActive) {
      onTrimDragEnd();
    }
  }

  function handleTrimKeyboard(boundary: TrimBoundary, event: KeyboardEvent<HTMLButtonElement>) {
    const currentRange = rangeRef.current;
    const step = keyboardStepMicros(frameRate, event.shiftKey);
    let requested: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        requested = boundaryValue(currentRange, boundary) - step;
        break;
      case "ArrowRight":
        requested = boundaryValue(currentRange, boundary) + step;
        break;
      case "PageDown":
        requested = boundaryValue(currentRange, boundary) - 1_000_000;
        break;
      case "PageUp":
        requested = boundaryValue(currentRange, boundary) + 1_000_000;
        break;
      case "Home":
        requested = 0;
        break;
      case "End":
        requested = currentRange.sourceDurationMicros;
        break;
    }
    if (requested === null) return;
    event.preventDefault();
    const next = moveTrimBoundary(currentRange, boundary, requested);
    syncRange(next);
    onChange(boundary, next);
    onTrimDragEnd();
  }

  function resetBoundary(boundary: TrimBoundary) {
    const currentRange = rangeRef.current;
    const requestedMicros = boundary === "start" ? 0 : currentRange.sourceDurationMicros;
    const next = moveTrimBoundary(currentRange, boundary, requestedMicros);
    syncRange(next);
    onChange(boundary, next);
    onTrimDragEnd();
  }

  function segmentPointerPosition(clientX: number) {
    const pointer = pointerMicros(clientX);
    if (!pointer) return null;
    return {
      pointerMicros: pointer.micros,
      snapReachMicros:
        pointer.bounds.width > 0
          ? (TIMELINE_SNAP_REACH_PX / pointer.bounds.width) * rangeRef.current.sourceDurationMicros
          : 0,
    };
  }

  function updateSegmentFromPointer(
    pointerMicros: number,
    snapReachMicros: number,
    snapToPlayhead: boolean,
  ) {
    const drag = segmentDragRef.current;
    if (!drag) return;
    const currentRange = rangeRef.current;
    const segmentDurationMicros = currentRange.endMicros - currentRange.startMicros;
    const pointerDeltaMicros = pointerMicros - drag.lastPointerMicros;
    const snapModifierChanged = drag.snapModifierActive !== snapToPlayhead;
    if (pointerDeltaMicros === 0 && !snapModifierChanged) return;
    drag.lastPointerMicros = pointerMicros;
    drag.snapModifierActive = snapToPlayhead;
    const snapState = advanceDirectionalSnapLatch(drag.snapLatch, pointerDeltaMicros);
    drag.snapLatch = snapState.latch;
    const requestedStartMicros = pointerMicros - drag.grabOffsetMicros - segmentDurationMicros / 2;
    const movedRange = moveTrimRange(currentRange, requestedStartMicros);
    const snapped =
      snapToPlayhead && !snapState.anchorIgnored
        ? snapMovedTrimRangeToPlayhead(movedRange, playheadMicros, snapReachMicros)
        : { range: movedRange, point: null };
    syncRange(snapped.range);
    setSegmentSnapPoint(snapped.point);
    const followedBoundary = onMoveSegment(snapped.range);
    drag.snapLatch = settleDirectionalSnapLatch(
      drag.snapLatch,
      snapped.point !== null,
      followedBoundary !== null,
    );
  }

  function startSegmentDrag(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const pointer = segmentPointerPosition(event.clientX);
    if (!pointer) return;
    const currentRange = rangeRef.current;
    const segmentCenterMicros =
      currentRange.startMicros + (currentRange.endMicros - currentRange.startMicros) / 2;
    segmentDragRef.current = {
      pointerId: event.pointerId,
      grabOffsetMicros: pointer.pointerMicros - segmentCenterMicros,
      lastPointerMicros: pointer.pointerMicros,
      snapModifierActive: event.shiftKey,
      snapLatch: createDirectionalSnapLatch(),
    };
    setSegmentDragging(true);
    onSegmentDragStart();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveSegmentDrag(event: PointerEvent<HTMLButtonElement>) {
    if (segmentDragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const pointer = segmentPointerPosition(event.clientX);
    if (pointer)
      updateSegmentFromPointer(pointer.pointerMicros, pointer.snapReachMicros, event.shiftKey);
  }

  function finishSegmentDrag(event: PointerEvent<HTMLButtonElement>, includePosition: boolean) {
    if (segmentDragRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (includePosition) {
      const pointer = segmentPointerPosition(event.clientX);
      if (pointer)
        updateSegmentFromPointer(pointer.pointerMicros, pointer.snapReachMicros, event.shiftKey);
    }
    segmentDragRef.current = null;
    setSegmentDragging(false);
    setSegmentSnapPoint(null);
    onSegmentDragEnd();
  }

  function handleSegmentKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const currentRange = rangeRef.current;
    const segmentDurationMicros = currentRange.endMicros - currentRange.startMicros;
    let requestedStartMicros: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        requestedStartMicros = currentRange.startMicros - frameDurationMicros(frameRate);
        break;
      case "ArrowRight":
        requestedStartMicros = currentRange.startMicros + frameDurationMicros(frameRate);
        break;
      case "PageDown":
        requestedStartMicros = currentRange.startMicros - 1_000_000;
        break;
      case "PageUp":
        requestedStartMicros = currentRange.startMicros + 1_000_000;
        break;
      case "Home":
        requestedStartMicros = 0;
        break;
      case "End":
        requestedStartMicros = currentRange.sourceDurationMicros - segmentDurationMicros;
        break;
    }
    if (requestedStartMicros === null) return;
    event.preventDefault();
    const next = moveTrimRange(currentRange, requestedStartMicros);
    syncRange(next);
    onMoveSegment(next);
    onSegmentDragEnd();
  }

  function scrubMicros(clientX: number, snapToTrim: boolean) {
    const pointer = pointerMicros(clientX);
    if (!pointer) return null;
    return snapToTrim ? clampToTrim(pointer.micros, rangeRef.current) : pointer.micros;
  }

  function startScrub(event: PointerEvent<HTMLElement>, captureTarget: HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    scrubPointerIdRef.current = event.pointerId;
    captureTarget.setPointerCapture?.(event.pointerId);
    onScrubStart();
    const micros = scrubMicros(event.clientX, event.shiftKey);
    if (micros !== null) onScrub(micros);
  }

  function moveScrub(event: PointerEvent<HTMLElement>) {
    if (scrubPointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const micros = scrubMicros(event.clientX, event.shiftKey);
    if (micros !== null) onScrub(micros);
  }

  function finishScrub(event: PointerEvent<HTMLElement>, includePosition: boolean) {
    if (scrubPointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (includePosition) {
      const micros = scrubMicros(event.clientX, event.shiftKey);
      if (micros !== null) onScrub(micros);
    }
    scrubPointerIdRef.current = null;
    onScrubEnd();
  }

  function handlePlayheadKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const sourceDurationMicros = rangeRef.current.sourceDurationMicros;
    const step = event.shiftKey ? 1_000_000 : frameDurationMicros(frameRate);
    let requested: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        requested = playheadMicros - step;
        break;
      case "ArrowRight":
        requested = playheadMicros + step;
        break;
      case "Home":
        requested = 0;
        break;
      case "End":
        requested = sourceDurationMicros;
        break;
    }
    if (requested === null) return;
    event.preventDefault();
    onScrubStart();
    onSeek(clampPlaybackMicros(requested, sourceDurationMicros));
    onScrubEnd();
  }

  return {
    trackRef,
    segmentDragging,
    segmentSnapPoint,
    trimDragState,
    handleTrimPointer,
    finishTrimDrag,
    handleTrimKeyboard,
    resetBoundary,
    startSegmentDrag,
    moveSegmentDrag,
    finishSegmentDrag,
    handleSegmentKeyboard,
    startScrub,
    moveScrub,
    finishScrub,
    handlePlayheadKeyboard,
  };
}

function keyboardStepMicros(frameRate: FrameRate | undefined, coarse: boolean): number {
  if (coarse) return 1_000_000;
  return frameDurationMicros(frameRate);
}

function boundaryValue(range: TrimRange, boundary: TrimBoundary): number {
  return boundary === "start" ? range.startMicros : range.endMicros;
}
