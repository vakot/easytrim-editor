import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { formatPlaybackTime } from "@/domain/playback";
import type { SegmentSnapPoint, TrimBoundary, TrimRange } from "@/domain/trim";
import { cn } from "@/lib/class-names.utils";
import type { FrameRate } from "@/lib/tauri/media.types";

import styles from "./TrimTimeline.module.css";

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
  snapPoint: SegmentSnapPoint | null;
}

export function SegmentDragHandle({
  disabled = false,
  dragging,
  onKeyDown,
  onLostPointerCapture,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  range,
  snapPoint,
}: SegmentDragHandleProps) {
  const { t } = useTranslation();
  const durationMicros = range.endMicros - range.startMicros;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={t("timeline.moveSegment")}
          aria-valuemax={range.sourceDurationMicros - durationMicros}
          aria-valuemin={0}
          aria-valuenow={range.startMicros}
          aria-valuetext={t("timeline.startsAt", {
            time: t("timeline.accessibleSeconds", {
              value: formatAccessibleTime(range.startMicros),
            }),
          })}
          className={cn(
            "segment-drag-handle",
            styles.segment,
            disabled && ["cursor-not-allowed", styles.segmentDisabled],
          )}
          data-dragging={dragging ? "true" : undefined}
          data-snap-active={snapPoint ? "true" : undefined}
          data-snap-point={snapPoint ?? undefined}
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
      </TooltipTrigger>
      <TooltipContent>{t("timeline.moveSegmentHint")}</TooltipContent>
    </Tooltip>
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

export function TrimHandle({
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
  const label = boundary === "start" ? t("timeline.trimStart") : t("timeline.trimEnd");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          aria-valuemax={maximum}
          aria-valuemin={minimum}
          aria-valuenow={value}
          aria-valuetext={t("timeline.accessibleSeconds", { value: formatAccessibleTime(value) })}
          className={cn(
            "trim-handle",
            `trim-handle-${boundary}`,
            styles.trim,
            boundary === "start" ? styles.start : styles.end,
            disabled && cn("cursor-not-allowed", styles.trimDisabled),
          )}
          data-dragging={dragging ? "true" : undefined}
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
      </TooltipTrigger>
      <TooltipContent>{t("timeline.trimResetHint", { label })}</TooltipContent>
    </Tooltip>
  );
}

export function Playhead({
  frameRate,
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
  frameRate?: FrameRate;
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={t("timeline.playbackPosition")}
          aria-valuemax={maximum}
          aria-valuemin={0}
          aria-valuenow={value}
          aria-valuetext={t("timeline.accessibleSeconds", {
            value: formatAccessibleTime(value),
          })}
          className={cn("playhead", styles.playhead)}
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
      </TooltipTrigger>
      <TooltipContent>{formatPlaybackTime(value, frameRate)}</TooltipContent>
    </Tooltip>
  );
}
