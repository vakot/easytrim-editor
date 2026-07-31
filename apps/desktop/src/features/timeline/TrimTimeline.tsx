import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import {
  clampPlaybackMicros,
  formatPlaybackTime,
  frameDurationMicros,
} from "../../domain/playback";
import {
  clampToTrim,
  microsFromTimelinePosition,
  minimumSelectionMicros,
  moveTrimBoundary,
  moveTrimRange,
  snapMovedTrimRangeToPlayhead,
  timelinePercent,
  type SegmentSnapPoint,
  type TrimBoundary,
  type TrimRange,
} from "../../domain/trim";
import type { FrameRate } from "../../lib/tauri/media";

const TIMELINE_SNAP_REACH_PX = 12;

interface TrimTimelineProps {
  range: TrimRange;
  playheadMicros: number;
  playheadRef: RefObject<HTMLButtonElement | null>;
  frameRate?: FrameRate;
  playbackControls: ReactNode;
  playbackTimecode: ReactNode;
  onChange: (boundary: TrimBoundary, range: TrimRange) => void;
  onMoveSegment: (range: TrimRange) => void;
  onSegmentDragStart: () => void;
  onSegmentDragEnd: () => void;
  onSeek: (micros: number) => void;
  onScrubStart: () => void;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
}

export function TrimTimeline({
  range,
  playheadMicros,
  playheadRef,
  frameRate,
  playbackControls,
  playbackTimecode,
  onChange,
  onMoveSegment,
  onSegmentDragStart,
  onSegmentDragEnd,
  onSeek,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: TrimTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubPointerIdRef = useRef<number | null>(null);
  const segmentDragRef = useRef<{
    pointerId: number;
    grabOffsetMicros: number;
    lastPointerMicros: number;
    snapModifierActive: boolean;
  } | null>(null);
  const [segmentDragging, setSegmentDragging] = useState(false);
  const [segmentSnapPoint, setSegmentSnapPoint] = useState<SegmentSnapPoint | null>(null);
  const [trimDragState, setTrimDragState] = useState<{
    boundary: TrimBoundary;
    snapActive: boolean;
  } | null>(null);
  const startPercent = timelinePercent(range.startMicros, range.sourceDurationMicros);
  const endPercent = timelinePercent(range.endMicros, range.sourceDurationMicros);
  const segmentDurationMicros = range.endMicros - range.startMicros;
  const segmentCenterMicros = range.startMicros + segmentDurationMicros / 2;
  const segmentCenterPercent = timelinePercent(segmentCenterMicros, range.sourceDurationMicros);
  const minimumDurationMicros = minimumSelectionMicros(range.sourceDurationMicros);
  const playheadPercent = timelinePercent(
    clampPlaybackMicros(playheadMicros, range.sourceDurationMicros),
    range.sourceDurationMicros,
  );

  function updateFromPointer(
    boundary: TrimBoundary,
    clientX: number,
    snapToPlayhead: boolean,
  ): boolean {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) {
      return false;
    }
    const pointerMicros = microsFromTimelinePosition(
      clientX,
      bounds.left,
      bounds.width,
      range.sourceDurationMicros,
    );
    const snapActive =
      snapToPlayhead &&
      isPointerNearPlayhead(
        clientX,
        bounds.left,
        bounds.width,
        playheadMicros,
        range.sourceDurationMicros,
      );
    const requestedMicros = snapActive ? playheadMicros : pointerMicros;
    const next = moveTrimBoundary(range, boundary, requestedMicros);
    onChange(boundary, next);
    return snapActive;
  }

  function handlePointer(
    boundary: TrimBoundary,
    event: PointerEvent<HTMLButtonElement>,
    capture: boolean,
  ) {
    if (capture) {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } else if (
      event.currentTarget.hasPointerCapture &&
      !event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      return;
    }
    const snapActive = updateFromPointer(boundary, event.clientX, event.shiftKey);
    setTrimDragState({ boundary, snapActive });
  }

  function finishTrimDrag(boundary: TrimBoundary) {
    setTrimDragState((current) => (current?.boundary === boundary ? null : current));
  }

  function handleKeyboard(boundary: TrimBoundary, event: KeyboardEvent<HTMLButtonElement>) {
    const step = keyboardStepMicros(frameRate, event.shiftKey);
    let requested: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        requested = boundaryValue(range, boundary) - step;
        break;
      case "ArrowRight":
        requested = boundaryValue(range, boundary) + step;
        break;
      case "PageDown":
        requested = boundaryValue(range, boundary) - 1_000_000;
        break;
      case "PageUp":
        requested = boundaryValue(range, boundary) + 1_000_000;
        break;
      case "Home":
        requested = 0;
        break;
      case "End":
        requested = range.sourceDurationMicros;
        break;
    }
    if (requested === null) {
      return;
    }
    event.preventDefault();
    const next = moveTrimBoundary(range, boundary, requested);
    onChange(boundary, next);
  }

  function resetBoundary(boundary: TrimBoundary) {
    const requestedMicros = boundary === "start" ? 0 : range.sourceDurationMicros;
    onChange(boundary, moveTrimBoundary(range, boundary, requestedMicros));
  }

  function segmentPointerPosition(
    clientX: number,
  ): { pointerMicros: number; snapReachMicros: number } | null {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) {
      return null;
    }
    return {
      pointerMicros: microsFromTimelinePosition(
        clientX,
        bounds.left,
        bounds.width,
        range.sourceDurationMicros,
      ),
      snapReachMicros:
        bounds.width > 0 ? (TIMELINE_SNAP_REACH_PX / bounds.width) * range.sourceDurationMicros : 0,
    };
  }

  function updateSegmentFromPointer(
    pointerMicros: number,
    snapReachMicros: number,
    snapToPlayhead: boolean,
  ) {
    const drag = segmentDragRef.current;
    if (!drag) {
      return;
    }
    const pointerDeltaMicros = pointerMicros - drag.lastPointerMicros;
    const snapModifierChanged = drag.snapModifierActive !== snapToPlayhead;
    if (pointerDeltaMicros === 0 && !snapModifierChanged) {
      return;
    }
    drag.lastPointerMicros = pointerMicros;
    drag.snapModifierActive = snapToPlayhead;
    const requestedStartMicros = pointerMicros - drag.grabOffsetMicros - segmentDurationMicros / 2;
    const movedRange = moveTrimRange(range, requestedStartMicros);
    const snapped = snapToPlayhead
      ? snapMovedTrimRangeToPlayhead(movedRange, playheadMicros, snapReachMicros)
      : { range: movedRange, point: null };
    setSegmentSnapPoint(snapped.point);
    onMoveSegment(snapped.range);
  }

  function startSegmentDrag(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const pointer = segmentPointerPosition(event.clientX);
    if (!pointer) {
      return;
    }
    segmentDragRef.current = {
      pointerId: event.pointerId,
      grabOffsetMicros: pointer.pointerMicros - segmentCenterMicros,
      lastPointerMicros: pointer.pointerMicros,
      snapModifierActive: event.shiftKey,
    };
    setSegmentDragging(true);
    onSegmentDragStart();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveSegmentDrag(event: PointerEvent<HTMLButtonElement>) {
    if (segmentDragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const pointer = segmentPointerPosition(event.clientX);
    if (pointer) {
      updateSegmentFromPointer(pointer.pointerMicros, pointer.snapReachMicros, event.shiftKey);
    }
  }

  function finishSegmentDrag(event: PointerEvent<HTMLButtonElement>, includePosition: boolean) {
    if (segmentDragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (includePosition) {
      const pointer = segmentPointerPosition(event.clientX);
      if (pointer) {
        updateSegmentFromPointer(pointer.pointerMicros, pointer.snapReachMicros, event.shiftKey);
      }
    }
    segmentDragRef.current = null;
    setSegmentDragging(false);
    setSegmentSnapPoint(null);
    onSegmentDragEnd();
  }

  function handleSegmentKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    let requestedStartMicros: number | null = null;
    switch (event.key) {
      case "ArrowLeft":
        requestedStartMicros = range.startMicros - frameDurationMicros(frameRate);
        break;
      case "ArrowRight":
        requestedStartMicros = range.startMicros + frameDurationMicros(frameRate);
        break;
      case "PageDown":
        requestedStartMicros = range.startMicros - 1_000_000;
        break;
      case "PageUp":
        requestedStartMicros = range.startMicros + 1_000_000;
        break;
      case "Home":
        requestedStartMicros = 0;
        break;
      case "End":
        requestedStartMicros = range.sourceDurationMicros - segmentDurationMicros;
        break;
    }
    if (requestedStartMicros === null) {
      return;
    }
    event.preventDefault();
    onMoveSegment(moveTrimRange(range, requestedStartMicros));
  }

  function scrubMicros(clientX: number, snapToTrim: boolean): number | null {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) {
      return null;
    }
    const pointerMicros = microsFromTimelinePosition(
      clientX,
      bounds.left,
      bounds.width,
      range.sourceDurationMicros,
    );
    return snapToTrim ? clampToTrim(pointerMicros, range) : pointerMicros;
  }

  function startScrub(event: PointerEvent<HTMLElement>, captureTarget: HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    scrubPointerIdRef.current = event.pointerId;
    captureTarget.setPointerCapture?.(event.pointerId);
    onScrubStart();
    const micros = scrubMicros(event.clientX, event.shiftKey);
    if (micros !== null) {
      onScrub(micros);
    }
  }

  function moveScrub(event: PointerEvent<HTMLElement>) {
    if (scrubPointerIdRef.current !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const micros = scrubMicros(event.clientX, event.shiftKey);
    if (micros !== null) {
      onScrub(micros);
    }
  }

  function finishScrub(event: PointerEvent<HTMLElement>, includePosition: boolean) {
    if (scrubPointerIdRef.current !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (includePosition) {
      const micros = scrubMicros(event.clientX, event.shiftKey);
      if (micros !== null) {
        onScrub(micros);
      }
    }
    scrubPointerIdRef.current = null;
    onScrubEnd();
  }

  function handlePlayheadKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
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
        requested = range.sourceDurationMicros;
        break;
    }
    if (requested === null) {
      return;
    }
    event.preventDefault();
    onScrubStart();
    onSeek(clampPlaybackMicros(requested, range.sourceDurationMicros));
    onScrubEnd();
  }

  return (
    <section className="timeline-panel" aria-labelledby="timeline-title">
      <div className="timeline-heading">
        <div className="timeline-heading-summary">
          <h2 id="timeline-title" className="section-label">
            Selected Segment
          </h2>
          {playbackTimecode}
        </div>
        <div className="timeline-heading-controls">{playbackControls}</div>
        <dl className="trim-readouts" aria-label="Trim time values">
          <TimeValue label="Start" micros={range.startMicros} />
          <TimeValue label="End" micros={range.endMicros} />
          <TimeValue label="Duration" micros={range.endMicros - range.startMicros} />
        </dl>
      </div>

      <div className="timeline-scale" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <span key={fraction}>
            {formatPlaybackTime(Math.round(range.sourceDurationMicros * fraction))}
          </span>
        ))}
      </div>

      <div className="timeline-row">
        <span className="timeline-row-label">Video</span>
        <div
          ref={trackRef}
          className="timeline-track"
          aria-label="Video trim timeline"
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) {
              return;
            }
            startScrub(event, event.currentTarget);
          }}
          onPointerMove={moveScrub}
          onPointerUp={(event) => finishScrub(event, true)}
          onPointerCancel={(event) => finishScrub(event, false)}
          onLostPointerCapture={(event) => finishScrub(event, false)}
        >
          <div
            className="trim-selection"
            style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
          />
          <SegmentDragHandle
            range={range}
            percent={segmentCenterPercent}
            dragging={segmentDragging}
            snapPoint={segmentSnapPoint}
            onPointerDown={startSegmentDrag}
            onPointerMove={moveSegmentDrag}
            onPointerUp={(event) => finishSegmentDrag(event, true)}
            onPointerCancel={(event) => finishSegmentDrag(event, false)}
            onLostPointerCapture={(event) => finishSegmentDrag(event, false)}
            onKeyDown={handleSegmentKeyboard}
          />
          <button
            ref={playheadRef}
            className="playhead"
            type="button"
            style={{ left: `${playheadPercent}%` }}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={range.sourceDurationMicros}
            aria-valuenow={clampPlaybackMicros(playheadMicros, range.sourceDurationMicros)}
            aria-valuetext={formatAccessibleTime(playheadMicros)}
            title={formatPlaybackTime(playheadMicros)}
            onPointerDown={(event) => startScrub(event, event.currentTarget)}
            onPointerMove={moveScrub}
            onPointerUp={(event) => finishScrub(event, true)}
            onPointerCancel={(event) => finishScrub(event, false)}
            onLostPointerCapture={(event) => finishScrub(event, false)}
            onKeyDown={handlePlayheadKeyboard}
          />
          <TrimHandle
            boundary="start"
            value={range.startMicros}
            minimum={0}
            maximum={range.endMicros - minimumDurationMicros}
            percent={startPercent}
            dragging={trimDragState?.boundary === "start"}
            snapActive={trimDragState?.boundary === "start" && trimDragState.snapActive}
            onPointerDown={(event) => handlePointer("start", event, true)}
            onPointerMove={(event) => handlePointer("start", event, false)}
            onPointerEnd={() => finishTrimDrag("start")}
            onDoubleClick={() => resetBoundary("start")}
            onKeyDown={(event) => handleKeyboard("start", event)}
          />
          <TrimHandle
            boundary="end"
            value={range.endMicros}
            minimum={range.startMicros + minimumDurationMicros}
            maximum={range.sourceDurationMicros}
            percent={endPercent}
            dragging={trimDragState?.boundary === "end"}
            snapActive={trimDragState?.boundary === "end" && trimDragState.snapActive}
            onPointerDown={(event) => handlePointer("end", event, true)}
            onPointerMove={(event) => handlePointer("end", event, false)}
            onPointerEnd={() => finishTrimDrag("end")}
            onDoubleClick={() => resetBoundary("end")}
            onKeyDown={(event) => handleKeyboard("end", event)}
          />
        </div>
      </div>
    </section>
  );
}

interface SegmentDragHandleProps {
  range: TrimRange;
  percent: number;
  dragging: boolean;
  snapPoint: SegmentSnapPoint | null;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function SegmentDragHandle({
  range,
  percent,
  dragging,
  snapPoint,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
}: SegmentDragHandleProps) {
  const durationMicros = range.endMicros - range.startMicros;
  return (
    <button
      className="segment-drag-handle"
      type="button"
      role="slider"
      aria-label="Move selected segment"
      aria-valuemin={0}
      aria-valuemax={range.sourceDurationMicros - durationMicros}
      aria-valuenow={range.startMicros}
      aria-valuetext={`Starts at ${formatAccessibleTime(range.startMicros)}`}
      title="Drag to move the selected segment — hold Shift to snap"
      data-dragging={dragging ? "true" : undefined}
      data-snap-active={snapPoint ? "true" : undefined}
      data-snap-point={snapPoint ?? undefined}
      style={{ left: `${percent}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onKeyDown={onKeyDown}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7 7-5 5 5 5v-3h10v3l5-5-5-5v3H7z" />
      </svg>
    </button>
  );
}

interface TrimHandleProps {
  boundary: TrimBoundary;
  value: number;
  minimum: number;
  maximum: number;
  percent: number;
  dragging: boolean;
  snapActive: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnd: () => void;
  onDoubleClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function TrimHandle({
  boundary,
  value,
  minimum,
  maximum,
  percent,
  dragging,
  snapActive,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onDoubleClick,
  onKeyDown,
}: TrimHandleProps) {
  const label = boundary === "start" ? "Trim start" : "Trim end";
  return (
    <button
      className={`trim-handle trim-handle-${boundary}`}
      type="button"
      role="slider"
      aria-label={label}
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={value}
      aria-valuetext={formatAccessibleTime(value)}
      title={`${label} — double-click to reset`}
      data-dragging={dragging ? "true" : undefined}
      data-snap-active={snapActive ? "true" : undefined}
      style={{ left: `${percent}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <span aria-hidden="true" />
    </button>
  );
}

function TimeValue({ label, micros }: { label: string; micros: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{formatPlaybackTime(micros)}</dd>
    </div>
  );
}

function keyboardStepMicros(frameRate: FrameRate | undefined, coarse: boolean): number {
  if (coarse) {
    return 1_000_000;
  }
  if (!frameRate) {
    return frameDurationMicros(undefined);
  }
  return frameDurationMicros(frameRate);
}

function boundaryValue(range: TrimRange, boundary: TrimBoundary): number {
  return boundary === "start" ? range.startMicros : range.endMicros;
}

function isPointerNearPlayhead(
  clientX: number,
  timelineLeft: number,
  timelineWidth: number,
  playheadMicros: number,
  sourceDurationMicros: number,
): boolean {
  if (timelineWidth <= 0 || sourceDurationMicros <= 0) {
    return false;
  }
  const clampedPlayhead = clampPlaybackMicros(playheadMicros, sourceDurationMicros);
  const playheadX = timelineLeft + (clampedPlayhead / sourceDurationMicros) * timelineWidth;
  return Math.abs(clientX - playheadX) <= TIMELINE_SNAP_REACH_PX;
}

function formatAccessibleTime(micros: number): string {
  return `${(micros / 1_000_000).toFixed(3)} seconds`;
}
