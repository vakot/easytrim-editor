import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import {
  clampPlaybackMicros,
  formatPlaybackTime,
  frameDurationMicros,
} from "../../domain/playback";
import {
  advanceDirectionalSnapLatch,
  clampToTrim,
  createDirectionalSnapLatch,
  microsFromTimelinePosition,
  minimumSelectionMicros,
  moveTrimBoundary,
  moveTrimRange,
  snapMovedTrimRangeToPlayhead,
  settleDirectionalSnapLatch,
  timelinePercent,
  type DirectionalSnapLatch,
  type SegmentSnapPoint,
  type TrimBoundary,
  type TrimRange,
} from "../../domain/trim";
import type { FrameRate } from "../../lib/tauri/media";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import styles from "./components/timeline-handles.module.css";
import type { TrimTimelineProps } from "./types";

const TIMELINE_SNAP_REACH_PX = 12;

export function TrimTimeline({
  range,
  playheadMicros,
  playheadRef,
  frameRate,
  playbackControls,
  playbackTimecode,
  videoToolbar,
  audioRows,
  onChange,
  onMoveSegment,
  onSegmentDragStart,
  onSegmentDragEnd,
  onSeek,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: TrimTimelineProps) {
  const { t } = useTranslation();
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
    const drag = trimDragRef.current;
    if (!drag || drag.boundary !== boundary) {
      return false;
    }
    const snapState = advanceDirectionalSnapLatch(
      drag.snapLatch,
      pointerMicros - drag.lastPointerMicros,
    );
    drag.lastPointerMicros = pointerMicros;
    drag.snapLatch = snapState.latch;
    const snapActive =
      snapToPlayhead &&
      !snapState.anchorIgnored &&
      isPointerNearPlayhead(
        clientX,
        bounds.left,
        bounds.width,
        playheadMicros,
        range.sourceDurationMicros,
      );
    const requestedMicros = snapActive ? playheadMicros : pointerMicros;
    const next = moveTrimBoundary(range, boundary, requestedMicros);
    const followedBoundary = onChange(boundary, next);
    drag.snapLatch = settleDirectionalSnapLatch(
      drag.snapLatch,
      snapActive,
      followedBoundary === boundary,
    );
    return snapActive;
  }

  function handlePointer(
    boundary: TrimBoundary,
    event: PointerEvent<HTMLButtonElement>,
    capture: boolean,
  ) {
    if (capture) {
      trimDragRef.current = {
        pointerId: event.pointerId,
        boundary,
        lastPointerMicros: boundaryValue(range, boundary),
        snapLatch: createDirectionalSnapLatch(),
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } else {
      if (trimDragRef.current?.pointerId !== event.pointerId) {
        return;
      }
      if (
        event.currentTarget.hasPointerCapture &&
        !event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        return;
      }
    }
    const snapActive = updateFromPointer(boundary, event.clientX, event.shiftKey);
    setTrimDragState({ boundary, snapActive });
  }

  function finishTrimDrag(boundary: TrimBoundary) {
    if (trimDragRef.current?.boundary === boundary) {
      trimDragRef.current = null;
    }
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
    const snapState = advanceDirectionalSnapLatch(drag.snapLatch, pointerDeltaMicros);
    drag.snapLatch = snapState.latch;
    const requestedStartMicros = pointerMicros - drag.grabOffsetMicros - segmentDurationMicros / 2;
    const movedRange = moveTrimRange(range, requestedStartMicros);
    const snapped =
      snapToPlayhead && !snapState.anchorIgnored
        ? snapMovedTrimRangeToPlayhead(movedRange, playheadMicros, snapReachMicros)
        : { range: movedRange, point: null };
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
    if (!pointer) {
      return;
    }
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
    <section
      className="min-h-full min-w-0 select-none bg-background px-5 pt-4 pb-5"
      aria-labelledby="timeline-title"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6">
        <div className="min-w-0 justify-self-start">
          <h2
            id="timeline-title"
            className="mb-0.5 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
          >
            {t("timeline.selectedSegment")}
          </h2>
          {playbackTimecode}
        </div>
        <div className="justify-self-center">{playbackControls}</div>
        <dl className="m-0 flex justify-self-end gap-5" aria-label={t("timeline.trimValues")}>
          <TimeValue label={t("timeline.start")} micros={range.startMicros} frameRate={frameRate} />
          <TimeValue label={t("timeline.end")} micros={range.endMicros} frameRate={frameRate} />
          <TimeValue
            label={t("timeline.duration")}
            micros={range.endMicros - range.startMicros}
            frameRate={frameRate}
          />
        </dl>
      </div>

      <div
        className="mt-3 mb-1 grid min-w-0 grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] items-end gap-3"
        aria-hidden="true"
      >
        <span
          className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase"
          data-slot="timeline-tools-title"
        >
          {t("timeline.tools")}
        </span>
        <div className="flex justify-between font-mono text-[0.625rem] text-muted-foreground">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
            <span key={fraction}>
              {formatPlaybackTime(Math.round(range.sourceDurationMicros * fraction), frameRate)}
            </span>
          ))}
        </div>
      </div>

      <div
        className="mb-2 grid min-w-0 grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)] items-center gap-3"
        data-slot="timeline-row"
      >
        <div
          className="grid w-4/5 grid-flow-col grid-cols-4 grid-rows-2 items-center justify-start gap-1.5"
          data-slot="timeline-toolbar"
          role="toolbar"
          aria-label={t("timeline.toolsLabel")}
        >
          {videoToolbar}
        </div>
        <div
          ref={trackRef}
          className={styles.track}
          aria-label={t("timeline.trackLabel")}
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
            className={styles.selection}
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
            className={cn("playhead", styles.playhead)}
            type="button"
            style={{ left: `${playheadPercent}%` }}
            role="slider"
            aria-label={t("timeline.playbackPosition")}
            aria-valuemin={0}
            aria-valuemax={range.sourceDurationMicros}
            aria-valuenow={clampPlaybackMicros(playheadMicros, range.sourceDurationMicros)}
            aria-valuetext={t("timeline.accessibleSeconds", {
              value: formatAccessibleTime(playheadMicros),
            })}
            title={formatPlaybackTime(playheadMicros, frameRate)}
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
      {audioRows}
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
  const { t } = useTranslation();
  const durationMicros = range.endMicros - range.startMicros;
  return (
    <button
      className={cn("segment-drag-handle", styles.segment)}
      type="button"
      role="slider"
      aria-label={t("timeline.moveSegment")}
      aria-valuemin={0}
      aria-valuemax={range.sourceDurationMicros - durationMicros}
      aria-valuenow={range.startMicros}
      aria-valuetext={t("timeline.startsAt", {
        time: t("timeline.accessibleSeconds", {
          value: formatAccessibleTime(range.startMicros),
        }),
      })}
      title={t("timeline.moveSegmentHint")}
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
  const { t } = useTranslation();
  const label = boundary === "start" ? t("timeline.trimStart") : t("timeline.trimEnd");
  return (
    <button
      className={cn(
        "trim-handle",
        `trim-handle-${boundary}`,
        styles.trim,
        boundary === "start" ? styles.start : styles.end,
      )}
      type="button"
      role="slider"
      aria-label={label}
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={value}
      aria-valuetext={t("timeline.accessibleSeconds", { value: formatAccessibleTime(value) })}
      title={t("timeline.trimResetHint", { label })}
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

function TimeValue({
  label,
  micros,
  frameRate,
}: {
  label: string;
  micros: number;
  frameRate?: FrameRate;
}) {
  return (
    <div className="grid gap-px">
      <dt className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="m-0 font-mono text-xs tabular-nums">
        {formatPlaybackTime(micros, frameRate)}
      </dd>
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
  return (micros / 1_000_000).toFixed(3);
}
