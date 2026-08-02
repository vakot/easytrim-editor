import type { KeyboardEvent, PointerEvent, RefObject } from "react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

import { formatPlaybackTime } from "@/domain/playback";
import { formatAccessibleTime } from "../utils/timeline-format";
import type { SegmentSnapPoint, TrimBoundary, TrimRange } from "@/domain/trim";
import type { FrameRate } from "@/lib/tauri/media";
import styles from "./styles.module.css";

interface SegmentDragHandleProps {
  range: TrimRange;
  dragging: boolean;
  snapPoint: SegmentSnapPoint | null;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export function SegmentDragHandle({
  range,
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
    <Tooltip>
      <TooltipTrigger asChild>
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
          data-dragging={dragging ? "true" : undefined}
          data-snap-active={snapPoint ? "true" : undefined}
          data-snap-point={snapPoint ?? undefined}
          style={{ left: "var(--timeline-trim-center)" }}
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
      </TooltipTrigger>
      <TooltipContent>{t("timeline.moveSegmentHint")}</TooltipContent>
    </Tooltip>
  );
}

interface TrimHandleProps {
  boundary: TrimBoundary;
  value: number;
  minimum: number;
  maximum: number;
  dragging: boolean;
  snapActive: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnd: () => void;
  onDoubleClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export function TrimHandle({
  boundary,
  value,
  minimum,
  maximum,
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
    <Tooltip>
      <TooltipTrigger asChild>
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
          data-dragging={dragging ? "true" : undefined}
          data-snap-active={snapActive ? "true" : undefined}
          style={{
            left: boundary === "start" ? "var(--timeline-trim-start)" : "var(--timeline-trim-end)",
          }}
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
      </TooltipTrigger>
      <TooltipContent>{t("timeline.trimResetHint", { label })}</TooltipContent>
    </Tooltip>
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
    <Tooltip>
      <TooltipTrigger asChild>
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onLostPointerCapture}
          onKeyDown={onKeyDown}
        />
      </TooltipTrigger>
      <TooltipContent>{formatPlaybackTime(value, frameRate)}</TooltipContent>
    </Tooltip>
  );
}
