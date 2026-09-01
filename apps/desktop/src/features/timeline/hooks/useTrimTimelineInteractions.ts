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
import { snapToNearestPoint } from "@/lib/interaction/snap-points.utils";
import { syncTimelineGeometry } from "@/lib/interaction/timeline-geometry.utils";
import type { FrameRate } from "@/lib/tauri/media.types";

const TIMELINE_SNAP_REACH_PX = 12;

interface TrimTimelineInteractionOptions {
  frameRate?: FrameRate;
  onChange: (boundary: TrimBoundary, range: TrimRange) => TrimBoundary | null;
  onMoveSegment: (range: TrimRange) => TrimBoundary | null;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
  onScrubStart: () => void;
  onSeek: (micros: number) => void;
  onSegmentDragEnd: () => void;
  onSegmentDragStart: () => void;
  onTrimDragEnd: () => void;
  onTrimDragStart: () => void;
  playheadMicros: number;
  range: TrimRange;
}

interface TrimDragState {
  boundary: TrimBoundary;
  snapActive: boolean;
}

export function useTrimTimelineInteractions({
  frameRate,
  onChange,
  onMoveSegment,
  onScrub,
  onScrubEnd,
  onScrubStart,
  onSeek,
  onSegmentDragEnd,
  onSegmentDragStart,
  onTrimDragEnd,
  onTrimDragStart,
  playheadMicros,
  range,
}: TrimTimelineInteractionOptions) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubDragRef = useRef<{ bounds: DOMRect; pointerId: number } | null>(null);
  const trimDragRef = useRef<{
    boundary: TrimBoundary;
    bounds: DOMRect;
    lastPointerMicros: number;
    pointerId: number;
    snapLatch: DirectionalSnapLatch;
  } | null>(null);

  const segmentDragRef = useRef<{
    bounds: DOMRect;
    grabOffsetMicros: number;
    lastPointerMicros: number;
    pointerId: number;
    snapLatch: DirectionalSnapLatch;
    snapModifierActive: boolean;
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

  function pointerMicros(clientX: number, bounds: DOMRect) {
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
    const drag = trimDragRef.current;
    if (!drag || drag.boundary !== boundary) {
      return false;
    }
    const pointer = pointerMicros(clientX, drag.bounds);
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
      const bounds = trackRef.current?.getBoundingClientRect();
      if (!bounds) return;
      trimDragRef.current = {
        pointerId: event.pointerId,
        boundary,
        bounds,
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

  function segmentPointerPosition(clientX: number, bounds: DOMRect) {
    const pointer = pointerMicros(clientX, bounds);
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
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const pointer = segmentPointerPosition(event.clientX, bounds);
    const currentRange = rangeRef.current;
    const segmentCenterMicros =
      currentRange.startMicros + (currentRange.endMicros - currentRange.startMicros) / 2;

    segmentDragRef.current = {
      pointerId: event.pointerId,
      bounds,
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
    const drag = segmentDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const pointer = segmentPointerPosition(event.clientX, drag.bounds);
    updateSegmentFromPointer(pointer.pointerMicros, pointer.snapReachMicros, event.shiftKey);
  }

  function finishSegmentDrag(event: PointerEvent<HTMLButtonElement>, includePosition: boolean) {
    const drag = segmentDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (includePosition) {
      const pointer = segmentPointerPosition(event.clientX, drag.bounds);
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

  function scrubMicros(clientX: number, snapToTrim: boolean, bounds: DOMRect) {
    const pointer = pointerMicros(clientX, bounds);
    return snapToTrim ? clampToTrim(pointer.micros, rangeRef.current) : pointer.micros;
  }

  function startScrub(event: PointerEvent<HTMLElement>, captureTarget: HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    scrubDragRef.current = { bounds, pointerId: event.pointerId };
    captureTarget.setPointerCapture?.(event.pointerId);
    onScrubStart();
    onScrub(scrubMicros(event.clientX, event.shiftKey, bounds));
  }

  function moveScrub(event: PointerEvent<HTMLElement>) {
    const drag = scrubDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    event.preventDefault();
    onScrub(scrubMicros(event.clientX, event.shiftKey, drag.bounds));
  }

  function finishScrub(event: PointerEvent<HTMLElement>, includePosition: boolean) {
    const drag = scrubDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (includePosition) {
      onScrub(scrubMicros(event.clientX, event.shiftKey, drag.bounds));
    }
    scrubDragRef.current = null;
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
