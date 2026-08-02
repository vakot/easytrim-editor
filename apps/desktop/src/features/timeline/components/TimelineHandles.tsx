import type { KeyboardEvent, PointerEvent, RefObject } from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

import { formatPlaybackTime } from "@/domain/playback";
import { formatAccessibleTime } from "../utils/timeline-format";
import type { SegmentSnapPoint, TrimBoundary, TrimRange } from "@/domain/trim";
import type { FrameRate } from "@/lib/tauri/media";
import styles from "./styles.module.css";

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
  handleRef: RefObject<HTMLButtonElement | null>;
}

export function SegmentDragHandle({
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
  handleRef,
}: SegmentDragHandleProps) {
  const { t } = useTranslation();
  const durationMicros = range.endMicros - range.startMicros;
  return (
    <button
      ref={handleRef}
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
  handleRef: RefObject<HTMLButtonElement | null>;
}

export function TrimHandle({
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
  handleRef,
}: TrimHandleProps) {
  const { t } = useTranslation();
  const label = boundary === "start" ? t("timeline.trimStart") : t("timeline.trimEnd");
  return (
    <button
      ref={handleRef}
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

export function Playhead({
  playheadRef,
  percent,
  value,
  maximum,
  frameRate,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
}: {
  playheadRef: RefObject<HTMLButtonElement | null>;
  percent: number;
  value: number;
  maximum: number;
  frameRate?: FrameRate;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      ref={playheadRef}
      className={cn("playhead", styles.playhead)}
      type="button"
      style={{ left: `${percent}%` }}
      role="slider"
      aria-label={t("timeline.playbackPosition")}
      aria-valuemin={0}
      aria-valuemax={maximum}
      aria-valuenow={value}
      aria-valuetext={t("timeline.accessibleSeconds", {
        value: formatAccessibleTime(value),
      })}
      title={formatPlaybackTime(value, frameRate)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onKeyDown={onKeyDown}
    />
  );
}
