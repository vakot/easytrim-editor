import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";

import { clampPlaybackMicros, frameDurationMicros } from "@/domain/playback";
import {
  microsFromTimelinePosition,
  moveTrimBoundary,
  moveTrimRange,
  type SegmentSnapPoint,
  type TrimBoundary,
  type TrimRange,
} from "@/domain/trim";
import { syncTimelineGeometry } from "@/lib/interaction/timeline-geometry.utils";
import type { FrameRate } from "@/lib/tauri/media.types";

import {
  createTimelineSnapAnchors,
  findNearestTimelineSnapAnchor,
  type TimelineSnapAnchorId,
} from "../lib/timeline-snap";

interface TrimTimelineInteractionOptions {
  frameRate?: FrameRate;
  onChange: (boundary: TrimBoundary, range: TrimRange) => void;
  onMoveSegment: (range: TrimRange) => void;
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
  snapTargetsMicros: readonly number[];
}

interface TrimDragState {
  boundary: TrimBoundary;
  snapActive: boolean;
}

function useTrimTimelineInteractions({
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
  snapTargetsMicros,
}: TrimTimelineInteractionOptions) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubDragRef = useRef<{ bounds: DOMRect; pointerId: number } | null>(null);
  const trimDragRef = useRef<{
    boundary: TrimBoundary;
    bounds: DOMRect;
    pointerId: number;
  } | null>(null);

  const segmentDragRef = useRef<{
    bounds: DOMRect;
    grabOffsetMicros: number;
    lastPointerMicros: number;
    pointerId: number;
    snapModifierActive: boolean;
  } | null>(null);

  const rangeRef = useRef(range);
  const geometryFrameRef = useRef<number | null>(null);
  const [scrubDragging, setScrubDragging] = useState(false);
  const [segmentDragging, setSegmentDragging] = useState(false);
  const [segmentSnapPoint, setSegmentSnapPoint] = useState<SegmentSnapPoint | null>(null);
  const [trimDragState, setTrimDragState] = useState<TrimDragState | null>(null);

  useEffect(() => {
    if (!trimDragRef.current && !segmentDragRef.current) {
      rangeRef.current = range;
    }
  }, [range]);

  useEffect(
    () => () => {
      if (geometryFrameRef.current !== null) cancelAnimationFrame(geometryFrameRef.current);
    },
    [],
  );

  function flushGeometry() {
    if (geometryFrameRef.current !== null) cancelAnimationFrame(geometryFrameRef.current);
    geometryFrameRef.current = null;
    syncTimelineGeometry(
      trackRef.current?.closest<HTMLElement>("[data-slot='timeline-pane']") ?? null,
      rangeRef.current,
    );
  }

  function syncRange(nextRange: TrimRange) {
    rangeRef.current = nextRange;
    if (geometryFrameRef.current !== null) return;
    geometryFrameRef.current = requestAnimationFrame(flushGeometry);
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

  function nearestSnapAnchor(
    positionMicros: number,
    bounds: DOMRect,
    activeAnchorId: TimelineSnapAnchorId,
    excludedAnchorIds: readonly TimelineSnapAnchorId[] = [],
  ) {
    const currentRange = rangeRef.current;
    return findNearestTimelineSnapAnchor(
      positionMicros,
      bounds.width,
      currentRange.sourceDurationMicros,
      createTimelineSnapAnchors(
        clampPlaybackMicros(playheadMicros, currentRange.sourceDurationMicros),
        currentRange,
        snapTargetsMicros,
      ),
      activeAnchorId,
      excludedAnchorIds,
    );
  }

  function updateTrimFromPointer(
    boundary: TrimBoundary,
    clientX: number,
    snapModifierActive: boolean,
  ): boolean {
    const drag = trimDragRef.current;
    if (!drag || drag.boundary !== boundary) {
      return false;
    }
    const pointer = pointerMicros(clientX, drag.bounds);
    const snapTarget = snapModifierActive
      ? nearestSnapAnchor(pointer.micros, pointer.bounds, `trim-${boundary}`, ["trim-center"])
      : null;

    const next = moveTrimBoundary(
      rangeRef.current,
      boundary,
      snapTarget?.timeMicros ?? pointer.micros,
    );

    syncRange(next);
    onChange(boundary, next);
    return snapTarget !== null;
  }

  function handleTrimPointer(
    boundary: TrimBoundary,
    event: PointerEvent<HTMLButtonElement>,
    capture: boolean,
  ) {
    if (capture) {
      if (event.button !== 0 || event.isPrimary === false) return;
      const bounds = trackRef.current?.getBoundingClientRect();
      if (!bounds) return;
      trimDragRef.current = {
        pointerId: event.pointerId,
        boundary,
        bounds,
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
      flushGeometry();
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
    return pointer.micros;
  }

  function updateSegmentFromPointer(pointerMicros: number, snapModifierActive: boolean) {
    const drag = segmentDragRef.current;
    if (!drag) return;
    const currentRange = rangeRef.current;
    const segmentDurationMicros = currentRange.endMicros - currentRange.startMicros;
    const pointerDeltaMicros = pointerMicros - drag.lastPointerMicros;
    const snapModifierChanged = drag.snapModifierActive !== snapModifierActive;
    if (pointerDeltaMicros === 0 && !snapModifierChanged) return;
    drag.lastPointerMicros = pointerMicros;
    drag.snapModifierActive = snapModifierActive;
    const requestedCenterMicros = pointerMicros - drag.grabOffsetMicros;
    const snapTarget = snapModifierActive
      ? nearestSnapAnchor(requestedCenterMicros, drag.bounds, "trim-center", [
          "trim-start",
          "trim-end",
        ])
      : null;

    const requestedCenter = snapTarget?.timeMicros ?? requestedCenterMicros;
    const next = moveTrimRange(currentRange, requestedCenter - segmentDurationMicros / 2);

    syncRange(next);
    setSegmentSnapPoint(snapTarget ? "center" : null);
    onMoveSegment(next);
  }

  function startSegmentDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.stopPropagation();
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const pointerPositionMicros = segmentPointerPosition(event.clientX, bounds);
    const currentRange = rangeRef.current;
    const segmentCenterMicros =
      currentRange.startMicros + (currentRange.endMicros - currentRange.startMicros) / 2;

    segmentDragRef.current = {
      pointerId: event.pointerId,
      bounds,
      grabOffsetMicros: pointerPositionMicros - segmentCenterMicros,
      lastPointerMicros: pointerPositionMicros,
      snapModifierActive: event.shiftKey,
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
    const pointerPositionMicros = segmentPointerPosition(event.clientX, drag.bounds);
    updateSegmentFromPointer(pointerPositionMicros, event.shiftKey);
  }

  function finishSegmentDrag(event: PointerEvent<HTMLButtonElement>, includePosition: boolean) {
    const drag = segmentDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (includePosition) {
      const pointerPositionMicros = segmentPointerPosition(event.clientX, drag.bounds);
      updateSegmentFromPointer(pointerPositionMicros, event.shiftKey);
    }
    segmentDragRef.current = null;
    flushGeometry();
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

  function scrubMicros(clientX: number, snapModifierActive: boolean, bounds: DOMRect) {
    const pointer = pointerMicros(clientX, bounds);
    if (!snapModifierActive) return pointer.micros;

    const snapTarget = nearestSnapAnchor(pointer.micros, bounds, "playhead");

    return snapTarget?.timeMicros ?? pointer.micros;
  }

  function startScrub(event: PointerEvent<HTMLElement>, captureTarget: HTMLElement) {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.stopPropagation();
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) return;
    scrubDragRef.current = { bounds, pointerId: event.pointerId };
    setScrubDragging(true);
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
    setScrubDragging(false);
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
    scrubDragging,
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

export { useTrimTimelineInteractions };
