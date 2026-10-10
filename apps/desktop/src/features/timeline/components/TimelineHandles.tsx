import { GripHorizontal, GripVertical } from "lucide-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { timelinePercent, type TrimBoundary } from "@/domain/trim";
import { cn } from "@/lib/class-names.utils";

function formatAccessibleTime(micros: number): string {
  return (micros / 1_000_000).toFixed(3);
}

function SegmentDragHandle({
  className,
  dragging,
  max,
  min,
  snapActive,
  value,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  dragging: boolean;
  max: number;
  min: number;
  snapActive: boolean;
  value: number;
}) {
  const { t } = useTranslation();

  return (
    <Button
      aria-label={t("timeline.segment.actions.moveSegment")}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={t("timeline.playhead.accessibility.startsAt", {
        time: t("timeline.playhead.accessibility.seconds", {
          value: formatAccessibleTime(value),
        }),
      })}
      className={cn(
        "absolute top-1/2 z-4 -translate-1/2! cursor-grab touch-none rounded-full transition-colors data-[dragging=true]:cursor-grabbing",
        className,
      )}
      data-dragging={dragging ? "true" : undefined}
      data-editor-keyboard="timeline-slider"
      data-snap-active={snapActive ? "true" : undefined}
      role="slider"
      size="icon-sm"
      style={{ left: "var(--timeline-trim-center)" }}
      type="button"
      {...props}
    >
      <GripHorizontal aria-hidden="true" />
    </Button>
  );
}

function TrimHandle({
  boundary,
  dragging,
  max,
  min,
  snapActive,
  value,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  boundary: TrimBoundary;
  dragging: boolean;
  max: number;
  min: number;
  snapActive: boolean;
  value: number;
}) {
  const { t } = useTranslation();
  const label =
    boundary === "start"
      ? t("timeline.segment.accessibility.trimStart")
      : t("timeline.segment.accessibility.trimEnd");

  return (
    <Button
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={t("timeline.playhead.accessibility.seconds", {
        value: formatAccessibleTime(value),
      })}
      className={cn(
        "absolute -inset-y-1 z-3 h-auto w-4 min-w-auto -translate-x-1/2 translate-y-0! cursor-ew-resize touch-none rounded-xs border-primary p-0 transition-colors hover:border-primary/80",
        boundary === "start" ? "rounded-l-md" : "rounded-r-md",
      )}
      data-dragging={dragging ? "true" : undefined}
      data-editor-keyboard="timeline-slider"
      data-snap-active={snapActive ? "true" : undefined}
      role="slider"
      style={{
        left: boundary === "start" ? "var(--timeline-trim-start)" : "var(--timeline-trim-end)",
      }}
      type="button"
      {...props}
    >
      <GripVertical aria-hidden="true" />
    </Button>
  );
}

function Playhead({
  dragging,
  max,
  min,
  value,
  ...props
}: React.ComponentProps<"button"> & {
  dragging: boolean;
  max: number;
  min: number;
  value: number;
}) {
  const { t } = useTranslation();

  return (
    <button
      aria-label={t("timeline.playhead.accessibility.playbackPosition")}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={t("timeline.playhead.accessibility.seconds", {
        value: formatAccessibleTime(value),
      })}
      className={cn(
        "absolute -inset-y-1 z-2 w-4 -translate-x-1/2 cursor-ew-resize touch-none bg-transparent! transition-colors outline-none before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-foreground before:content-[''] after:absolute after:top-0 after:left-1/2 after:size-2 after:-translate-1/2 after:rounded-full after:bg-foreground after:content-[''] focus-visible:before:border-ring focus-visible:before:ring-3 focus-visible:before:ring-ring/50 focus-visible:after:border-ring focus-visible:after:ring-3 focus-visible:after:ring-ring/50 disabled:pointer-events-none disabled:before:bg-muted-foreground disabled:after:bg-muted-foreground",
      )}
      data-dragging={dragging ? "true" : undefined}
      data-editor-keyboard="timeline-slider"
      role="slider"
      style={{ left: `${timelinePercent(value, max)}%` }}
      type="button"
      {...props}
    />
  );
}

export { Playhead, SegmentDragHandle, TrimHandle };
