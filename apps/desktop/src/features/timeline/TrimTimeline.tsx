import { useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

import {
  clampPlaybackMicros,
  formatPlaybackTime,
  frameDurationMicros,
} from "../../domain/playback";
import {
  microsFromTimelinePosition,
  moveTrimBoundary,
  timelinePercent,
  type TrimBoundary,
  type TrimRange,
} from "../../domain/trim";
import type { FrameRate } from "../../lib/tauri/media";

interface TrimTimelineProps {
  range: TrimRange;
  playheadMicros: number;
  playheadRef: RefObject<HTMLButtonElement | null>;
  frameRate?: FrameRate;
  onChange: (range: TrimRange) => void;
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
  onChange,
  onSeek,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: TrimTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubPointerIdRef = useRef<number | null>(null);
  const startPercent = timelinePercent(range.startMicros, range.sourceDurationMicros);
  const endPercent = timelinePercent(range.endMicros, range.sourceDurationMicros);
  const playheadPercent = timelinePercent(
    clampPlaybackMicros(playheadMicros, range.sourceDurationMicros),
    range.sourceDurationMicros,
  );

  function updateFromPointer(boundary: TrimBoundary, clientX: number) {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }
    const requestedMicros = microsFromTimelinePosition(
      clientX,
      bounds.left,
      bounds.width,
      range.sourceDurationMicros,
    );
    const next = moveTrimBoundary(range, boundary, requestedMicros);
    onChange(next);
    onSeek(boundary === "start" ? next.startMicros : next.endMicros);
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
    updateFromPointer(boundary, event.clientX);
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
    onChange(next);
    onSeek(boundary === "start" ? next.startMicros : next.endMicros);
  }

  function scrubMicros(clientX: number): number | null {
    const bounds = trackRef.current?.getBoundingClientRect();
    if (!bounds) {
      return null;
    }
    return microsFromTimelinePosition(
      clientX,
      bounds.left,
      bounds.width,
      range.sourceDurationMicros,
    );
  }

  function startScrub(event: PointerEvent<HTMLElement>, captureTarget: HTMLElement) {
    event.preventDefault();
    event.stopPropagation();
    scrubPointerIdRef.current = event.pointerId;
    captureTarget.setPointerCapture?.(event.pointerId);
    onScrubStart();
    const micros = scrubMicros(event.clientX);
    if (micros !== null) {
      onScrub(micros);
    }
  }

  function moveScrub(event: PointerEvent<HTMLElement>) {
    if (scrubPointerIdRef.current !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const micros = scrubMicros(event.clientX);
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
      const micros = scrubMicros(event.clientX);
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
        <div>
          <p className="section-label">Selected segment</p>
          <h2 id="timeline-title">Trim</h2>
        </div>
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
            maximum={range.endMicros - 1}
            percent={startPercent}
            onPointerDown={(event) => handlePointer("start", event, true)}
            onPointerMove={(event) => handlePointer("start", event, false)}
            onKeyDown={(event) => handleKeyboard("start", event)}
          />
          <TrimHandle
            boundary="end"
            value={range.endMicros}
            minimum={range.startMicros + 1}
            maximum={range.sourceDurationMicros}
            percent={endPercent}
            onPointerDown={(event) => handlePointer("end", event, true)}
            onPointerMove={(event) => handlePointer("end", event, false)}
            onKeyDown={(event) => handleKeyboard("end", event)}
          />
        </div>
      </div>
    </section>
  );
}

interface TrimHandleProps {
  boundary: TrimBoundary;
  value: number;
  minimum: number;
  maximum: number;
  percent: number;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function TrimHandle({
  boundary,
  value,
  minimum,
  maximum,
  percent,
  onPointerDown,
  onPointerMove,
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
      style={{ left: `${percent}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
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

function formatAccessibleTime(micros: number): string {
  return `${(micros / 1_000_000).toFixed(3)} seconds`;
}
