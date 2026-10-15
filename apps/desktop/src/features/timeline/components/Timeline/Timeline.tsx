import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDragAwareDoubleClick } from "@/components/ui/useDragAwareDoubleClick";

import { cn } from "@/lib/class-names.utils";

import { TimelineContext, useTimeline } from "./contexts/timeline-context";
import { microsAtClientX, percentOf, snapToTargets } from "./lib/timeline-scale";

const SNAP_THRESHOLD_PIXELS = 12;

type TimelineRootProps = Omit<React.ComponentProps<"div">, "onPointerDown"> & {
  disabled?: boolean;
  durationMicros: number;
  onScrub?: (micros: number) => void;
  onScrubEnd?: () => void;
  onScrubStart?: () => void;
  /**
   * Named times a Shift-drag snaps to, read when the pointer moves so moving targets such as the
   * playhead are current. A dragged part excludes its own names, never other targets that happen
   * to share its time.
   */
  snapTargets?: () => readonly TimelineSnapTarget[];
};

interface TimelineSnapTarget {
  key: string;
  micros: number;
}

/**
 * A horizontal time axis from 0 to `durationMicros`. Pressing anywhere outside a handle scrubs;
 * positioned parts (markers, ranges, handles) are placed by time.
 */
function Root({
  children,
  className,
  disabled = false,
  durationMicros,
  onScrub,
  onScrubEnd,
  onScrubStart,
  snapTargets,
  ...props
}: TimelineRootProps) {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const scrubbing = React.useRef(false);
  const [scrubSnapped, setScrubSnapped] = React.useState(false);

  const pointerMicros = React.useCallback(
    (event: React.PointerEvent, exclude: readonly string[] = []) => {
      const bounds = layerRef.current?.getBoundingClientRect();
      if (!bounds) return { micros: 0, snapped: false };
      const micros = microsAtClientX(event.clientX, bounds.left, bounds.width, durationMicros);
      if (!event.shiftKey) return { micros, snapped: false };
      const snapped = snapToTargets(
        micros,
        (snapTargets?.() ?? [])
          .filter((target) => !exclude.includes(target.key))
          .map((target) => target.micros),
        { durationMicros, thresholdPixels: SNAP_THRESHOLD_PIXELS, width: bounds.width },
      );

      return { micros: snapped, snapped: snapped !== micros };
    },
    [durationMicros, snapTargets],
  );

  const context = React.useMemo(
    () => ({ disabled, durationMicros, pointerMicros, scrubSnapped }),
    [disabled, durationMicros, pointerMicros, scrubSnapped],
  );

  function scrubTo(event: React.PointerEvent) {
    const { micros, snapped } = pointerMicros(event, SCRUB_EXCLUDES);
    setScrubSnapped(snapped);
    onScrub?.(micros);
  }

  function endScrub(event: React.PointerEvent) {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    setScrubSnapped(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onScrubEnd?.();
  }

  return (
    <TimelineContext.Provider value={context}>
      <div
        className={cn("relative touch-none select-none", className)}
        data-disabled={disabled ? "" : undefined}
        data-slot="timeline"
        onLostPointerCapture={endScrub}
        onPointerCancel={endScrub}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0 || event.isPrimary === false) return;
          scrubbing.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          onScrubStart?.();
          scrubTo(event);
        }}
        onPointerMove={(event) => {
          if (scrubbing.current) scrubTo(event);
        }}
        onPointerUp={endScrub}
        {...props}
      >
        {/* Inset so parts centered on the first and last instant stay inside the timeline. */}
        <div className="relative size-full" data-slot="timeline-layer" ref={layerRef}>
          {children}
        </div>
      </div>
    </TimelineContext.Provider>
  );
}

/** The track background, spanning the whole timeline including its edge insets. */
function Track({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      data-slot="timeline-track"
      {...props}
    />
  );
}

/** A mark at `micros`, with an optional label above the timeline. */
function Marker({
  children,
  className,
  label,
  micros,
  style,
  ...props
}: React.ComponentProps<"span"> & { label?: React.ReactNode; micros: number }) {
  const { durationMicros } = useTimeline();
  const percent = percentOf(micros, durationMicros);
  const labelAlignment =
    percent >= 100 ? "right-0 text-right" : percent <= 0 ? "left-0" : "left-0 -translate-x-1/2";

  return (
    <span
      className={cn(
        "pointer-events-none absolute -inset-y-0.5 w-px -translate-x-1/2 bg-muted-foreground/70",
        className,
      )}
      data-micros={micros}
      data-slot="timeline-marker"
      style={{ left: `${percent}%`, ...style }}
      {...props}
    >
      {label !== undefined && (
        <span
          className={cn(
            "absolute bottom-full pb-0.5 text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground",
            labelAlignment,
          )}
          data-slot="timeline-marker-label"
        >
          {label}
        </span>
      )}
      {children}
    </span>
  );
}

/** A span from `startMicros` to `endMicros`. */
function Range({
  className,
  endMicros,
  startMicros,
  style,
  ...props
}: React.ComponentProps<"div"> & { endMicros: number; startMicros: number }) {
  const { durationMicros } = useTimeline();
  return (
    <div
      className={cn("pointer-events-none absolute inset-y-0 mx-2", className)}
      data-slot="timeline-range"
      style={{
        left: `${percentOf(startMicros, durationMicros)}%`,
        right: `${100 - percentOf(endMicros, durationMicros)}%`,
        ...style,
      }}
      {...props}
    />
  );
}

type HandleProps = Omit<React.ComponentProps<"span">, "onDrag" | "onDragEnd" | "onDragStart"> & {
  "aria-label": string;
  disabled?: boolean;
  maxMicros?: number;
  micros: number;
  minMicros?: number;
  onDrag?: (micros: number) => void;
  onDragEnd?: () => void;
  /** Receives the time under the pointer when the drag starts. */
  onDragStart?: (micros: number) => void;
  onEnd?: () => void;
  onHome?: () => void;
  onStep?: (direction: -1 | 1) => void;
  /** Marks the handle as the one a scrub moves, so it shows when the scrub snaps. */
  scrubbed?: boolean;
  /** Shows the value label even when the handle itself is not dragged, e.g. while scrubbing. */
  showValue?: boolean;
  /** Snap targets this handle never snaps to while dragged: its own, and any moving with it. */
  snapExclude?: readonly string[];
  /** Shown above the handle while it is dragged, and announced as its value. */
  valueText: string;
};

/** A draggable, keyboard-operable position at `micros`. */
function Handle({
  children,
  className,
  disabled = false,
  maxMicros,
  micros,
  minMicros = 0,
  onDoubleClick,
  onDrag,
  onDragEnd,
  onDragStart,
  onEnd,
  onHome,
  onKeyDown,
  onStep,
  scrubbed = false,
  showValue = false,
  snapExclude = [],
  style,
  valueText,
  ...props
}: HandleProps) {
  const timeline = useTimeline();
  const inactive = disabled || timeline.disabled;
  const [dragging, setDragging] = React.useState(false);
  const [dragSnapped, setDragSnapped] = React.useState(false);
  const snapActive = (dragging && dragSnapped) || (scrubbed && timeline.scrubSnapped);
  // A press that moved before release (a drag) must not complete a double click.
  const doubleClick = useDragAwareDoubleClick<HTMLSpanElement>(onDoubleClick);

  function endDrag(event: React.PointerEvent<HTMLSpanElement>) {
    if (!dragging) return;
    setDragging(false);
    setDragSnapped(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onDragEnd?.();
  }

  return (
    <span
      aria-disabled={inactive || undefined}
      aria-orientation="horizontal"
      aria-valuemax={maxMicros ?? timeline.durationMicros}
      aria-valuemin={minMicros}
      aria-valuenow={micros}
      aria-valuetext={valueText}
      className={cn("absolute inset-y-0 w-0 outline-none", className)}
      data-dragging={dragging ? "" : undefined}
      data-slot="timeline-handle"
      data-snap-active={snapActive ? "" : undefined}
      onDoubleClick={doubleClick.onDoubleClick}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (inactive || event.defaultPrevented) return;
        const action =
          event.key === "ArrowLeft" || event.key === "ArrowDown"
            ? () => onStep?.(-1)
            : event.key === "ArrowRight" || event.key === "ArrowUp"
              ? () => onStep?.(1)
              : event.key === "Home"
                ? onHome
                : event.key === "End"
                  ? onEnd
                  : undefined;

        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        action();
      }}
      onLostPointerCapture={endDrag}
      onPointerCancel={endDrag}
      onPointerCancelCapture={doubleClick.onPointerCancelCapture}
      onPointerDown={(event) => {
        // Handles own their drag; the timeline behind them must not scrub.
        event.stopPropagation();
        if (inactive || event.button !== 0 || event.isPrimary === false) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
        onDragStart?.(timeline.pointerMicros(event, snapExclude).micros);
      }}
      onPointerDownCapture={doubleClick.onPointerDownCapture}
      onPointerMove={(event) => {
        if (!dragging) return;
        const { micros: next, snapped } = timeline.pointerMicros(event, snapExclude);
        setDragSnapped(snapped);
        onDrag?.(next);
      }}
      onPointerMoveCapture={doubleClick.onPointerMoveCapture}
      onPointerUp={endDrag}
      onPointerUpCapture={doubleClick.onPointerUpCapture}
      role="slider"
      style={{ left: `${percentOf(micros, timeline.durationMicros)}%`, ...style }}
      tabIndex={inactive ? -1 : 0}
      {...props}
    >
      {children}
      {/* A collision-aware tooltip anchored on the handle's position keeps the value on screen. */}
      <Tooltip open={dragging || showValue}>
        <TooltipTrigger asChild>
          <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 size-0" />
        </TooltipTrigger>
        <TooltipContent
          className="font-mono"
          data-slot="timeline-handle-value"
          side="top"
          sideOffset={12}
          // The anchor moves with the handle's `left`, which Radix does not observe on its own.
          updatePositionStrategy="always"
        >
          {valueText}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

/** Scrubbing moves the playhead, so it never snaps to the playhead's own position. */
const SCRUB_EXCLUDES = ["playhead"] as const;

const Timeline = { Handle, Marker, Range, Root, Track };

export { Timeline };
export type { TimelineSnapTarget };
