import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { TrimBoundary, TrimRange } from "@/domain/trim";
import { cn } from "@/lib/class-names.utils";

import styles from "./TimelinePanel.module.css";

function formatAccessibleTime(micros: number): string {
  return (micros / 1_000_000).toFixed(3);
}

interface SegmentDragHandleProps {
  disabled?: boolean;
  dragging: boolean;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  range: TrimRange;
  snapActive: boolean;
}

function SegmentDragHandle({
  disabled = false,
  dragging,
  onKeyDown,
  onLostPointerCapture,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  range,
  snapActive,
}: SegmentDragHandleProps) {
  const { t } = useTranslation();
  const durationMicros = range.endMicros - range.startMicros;
  return (
    <button
      aria-label={t("timeline.segment.actions.moveSegment")}
      aria-valuemax={range.sourceDurationMicros - durationMicros}
      aria-valuemin={0}
      aria-valuenow={range.startMicros}
      aria-valuetext={t("timeline.playhead.accessibility.startsAt", {
        time: t("timeline.playhead.accessibility.seconds", {
          value: formatAccessibleTime(range.startMicros),
        }),
      })}
      className={cn(
        "segment-drag-handle",
        styles.segment,
        "select-none",
        disabled && ["cursor-not-allowed", styles.segmentDisabled],
      )}
      data-dragging={dragging ? "true" : undefined}
      data-editor-keyboard="timeline-slider"
      data-snap-active={snapActive ? "true" : undefined}
      disabled={disabled}
      onKeyDown={onKeyDown}
      onLostPointerCapture={onLostPointerCapture}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="slider"
      style={{ left: "var(--timeline-trim-center)" }}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m7 7-5 5 5 5v-3h10v3l5-5-5-5v3H7z" />
      </svg>
    </button>
  );
}

interface TrimHandleProps {
  boundary: TrimBoundary;
  disabled?: boolean;
  dragging: boolean;
  maximum: number;
  minimum: number;
  onDoubleClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnd: () => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  snapActive: boolean;
  value: number;
}

function TrimHandle({
  boundary,
  disabled = false,
  dragging,
  maximum,
  minimum,
  onDoubleClick,
  onKeyDown,
  onPointerDown,
  onPointerEnd,
  onPointerMove,
  snapActive,
  value,
}: TrimHandleProps) {
  const { t } = useTranslation();
  const label =
    boundary === "start"
      ? t("timeline.segment.accessibility.trimStart")
      : t("timeline.segment.accessibility.trimEnd");

  return (
    <button
      aria-label={label}
      aria-valuemax={maximum}
      aria-valuemin={minimum}
      aria-valuenow={value}
      aria-valuetext={t("timeline.playhead.accessibility.seconds", {
        value: formatAccessibleTime(value),
      })}
      className={cn(
        "trim-handle",
        `trim-handle-${boundary}`,
        styles.trim,
        boundary === "start" ? styles.start : styles.end,
        "select-none",
        disabled && cn("cursor-not-allowed", styles.trimDisabled),
      )}
      data-dragging={dragging ? "true" : undefined}
      data-editor-keyboard="timeline-slider"
      data-snap-active={snapActive ? "true" : undefined}
      disabled={disabled}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      onLostPointerCapture={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      role="slider"
      style={{
        left: boundary === "start" ? "var(--timeline-trim-start)" : "var(--timeline-trim-end)",
      }}
      type="button"
    >
      <span aria-hidden="true" />
    </button>
  );
}

function Playhead({
  disabled = false,
  dragging,
  maximum,
  onKeyDown,
  onLostPointerCapture,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  percent,
  playheadRef,
  value,
}: {
  disabled?: boolean;
  dragging: boolean;
  maximum: number;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  percent: number;
  playheadRef: RefObject<HTMLButtonElement | null>;
  value: number;
}) {
  const { t } = useTranslation();
  return (
    <button
      aria-label={t("timeline.playhead.accessibility.playbackPosition")}
      aria-valuemax={maximum}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={t("timeline.playhead.accessibility.seconds", {
        value: formatAccessibleTime(value),
      })}
      className={cn("playhead", "select-none", disabled && "opacity-30", styles.playhead)}
      data-dragging={dragging ? "true" : undefined}
      data-editor-keyboard="timeline-slider"
      disabled={disabled}
      onKeyDown={onKeyDown}
      onLostPointerCapture={onLostPointerCapture}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      ref={playheadRef}
      role="slider"
      style={{ left: `${percent}%` }}
      type="button"
    />
  );
}

export { Playhead, SegmentDragHandle, TrimHandle };
