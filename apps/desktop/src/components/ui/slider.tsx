"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDragAwareDoubleClick } from "@/components/ui/useDragAwareDoubleClick";

import { cn } from "@/lib/class-names.utils";

interface SliderMarker {
  label: React.ReactNode;
  value: number;
}

function Root({
  className,
  defaultValue,
  dir,
  disabled,
  inverted = false,
  max = 100,
  min = 0,
  minStepsBetweenThumbs = 0,
  onDoubleClick,
  onLostPointerCapture,
  onPointerCancelCapture,
  onPointerDownCapture,
  onPointerMoveCapture,
  onPointerUpCapture,
  onValueChange,
  onValueCommit,
  orientation = "horizontal",
  snap = false,
  snapTarget = true,
  snapThreshold = 12,
  step = 1,
  value,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  snap?: boolean | "shift";
  snapTarget?: boolean;
  snapThreshold?: number;
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? [min]);
  const values = value ?? uncontrolledValue;
  const pendingValue = React.useRef(values);
  const pointer = React.useRef<{
    coordinate: number;
    root: HTMLDivElement;
    shift: boolean;
    startCoordinate: number;
    startValue: number;
    thumb: Element | null;
  } | null>(null);

  function clearSnap() {
    const active = pointer.current;
    active?.root.removeAttribute("data-snap-active");
    active?.thumb?.removeAttribute("data-snap-active");
  }

  function changeValues(next: number[]) {
    const active = pointer.current;
    clearSnap();
    // Radix uses absolute pointer coordinates. Preserve where a single thumb
    // was grabbed, including visual children extending beyond its center.
    if (active?.thumb && next.length === 1) {
      const bounds = active.root.getBoundingClientRect();
      const length = orientation === "vertical" ? bounds.height : bounds.width;
      const reverse =
        orientation === "vertical"
          ? !inverted
          : ((dir ?? getComputedStyle(active.root).direction) === "rtl") !== inverted;

      if (length > 0) {
        const delta = ((active.coordinate - active.startCoordinate) / length) * (max - min);
        const requested = active.startValue + (reverse ? -delta : delta);
        next = [Math.max(min, Math.min(max, min + Math.round((requested - min) / step) * step))];
      }
    }
    if (active && snap && (snap === true || active.shift)) {
      const thumbs = Array.from(active.root.querySelectorAll('[data-slot="slider-thumb"]'));
      let index = active.thumb ? thumbs.indexOf(active.thumb) : -1;
      if (index < 0) index = next.findIndex((entry, i) => entry !== values[i]);
      if (index < 0) index = 0;
      active.thumb = thumbs[index] ?? null;
      const bounds = active.root.getBoundingClientRect();
      const vertical = orientation === "vertical";
      const length = vertical ? bounds.height : bounds.width;
      const origin = vertical ? bounds.top : bounds.left;
      const thumbBounds = active.thumb?.getBoundingClientRect();
      const thumbSize = thumbBounds ? (vertical ? thumbBounds.height : thumbBounds.width) : 0;
      const travel = length - thumbSize;
      const reverse = vertical
        ? !inverted
        : (dir ?? getComputedStyle(active.root).direction) === "rtl"
          ? !inverted
          : inverted;

      const requested = next[index] ?? min;
      const fraction = (requested - min) / (max - min);
      const coordinate = origin + thumbSize / 2 + (reverse ? 1 - fraction : fraction) * travel;
      const scope = active.root.closest('[data-slot="slider-group"]') ?? active.root;
      let distance = snapThreshold;
      let snapped: number | undefined;
      if (travel > 0 && max > min) {
        for (const target of scope.querySelectorAll(
          '[data-slot="slider-thumb"], [data-slot="slider-marker"]',
        )) {
          if (
            target === active.thumb ||
            target.closest('[data-slot="slider"][data-snap-target="false"]')
          )
            continue;
          if ((target.closest('[data-slot="slider-group"]') ?? active.root) !== scope) continue;
          const targetBounds = target.getBoundingClientRect();
          const targetCoordinate = vertical
            ? targetBounds.top + targetBounds.height / 2
            : targetBounds.left + targetBounds.width / 2;

          const targetFraction = (targetCoordinate - origin - thumbSize / 2) / travel;
          const targetValue = min + (reverse ? 1 - targetFraction : targetFraction) * (max - min);
          const rounded = Number((min + Math.round((targetValue - min) / step) * step).toFixed(10));
          const gap = step * minStepsBetweenThumbs;
          const lower = index > 0 ? next[index - 1]! + gap : min;
          const upper = index < next.length - 1 ? next[index + 1]! - gap : max;
          const targetDistance = Math.abs(targetCoordinate - coordinate);
          if (
            targetValue < min ||
            targetValue > max ||
            rounded < lower ||
            rounded > upper ||
            targetDistance > distance
          )
            continue;
          distance = targetDistance;
          snapped = rounded;
        }
      }
      if (snapped !== undefined) {
        next = next.map((entry, i) => (i === index ? snapped : entry));
        active.root.setAttribute("data-snap-active", "true");
        active.thumb?.setAttribute("data-snap-active", "true");
      }
    }
    pendingValue.current = next;
    if (value === undefined) setUncontrolledValue(next);
    onValueChange?.(next);
  }

  const dragAwareDoubleClick = useDragAwareDoubleClick<HTMLDivElement>(onDoubleClick);

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative isolate flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className,
      )}
      data-slot="slider"
      data-snap-target={snapTarget ? undefined : "false"}
      dir={dir}
      disabled={disabled}
      inverted={inverted}
      max={max}
      min={min}
      minStepsBetweenThumbs={minStepsBetweenThumbs}
      onDoubleClick={dragAwareDoubleClick.onDoubleClick}
      onLostPointerCapture={(event) => {
        clearSnap();
        pointer.current = null;
        onLostPointerCapture?.(event);
      }}
      onPointerCancelCapture={(event) => {
        clearSnap();
        pointer.current = null;
        dragAwareDoubleClick.onPointerCancelCapture(event);
        onPointerCancelCapture?.(event);
      }}
      onPointerDownCapture={(event) => {
        if (event.button !== 0 || event.isPrimary === false) {
          event.preventDefault();
          return;
        }
        dragAwareDoubleClick.onPointerDownCapture(event);
        onPointerDownCapture?.(event);
        if (!disabled && !event.defaultPrevented && event.button === 0) {
          pendingValue.current = values;
          pointer.current = {
            root: event.currentTarget,
            thumb:
              event.target instanceof Element
                ? event.target.closest('[data-slot="slider-thumb"]')
                : null,
            shift: event.shiftKey,
            startCoordinate: orientation === "vertical" ? event.clientY : event.clientX,
            coordinate: orientation === "vertical" ? event.clientY : event.clientX,
            startValue: values[0] ?? min,
          };
        }
      }}
      onPointerMoveCapture={(event) => {
        if (pointer.current) {
          pointer.current.shift = event.shiftKey;
          pointer.current.coordinate = orientation === "vertical" ? event.clientY : event.clientX;
        }
        dragAwareDoubleClick.onPointerMoveCapture(event);
        onPointerMoveCapture?.(event);
      }}
      onPointerUpCapture={(event) => {
        dragAwareDoubleClick.onPointerUpCapture(event);
        onPointerUpCapture?.(event);
        const active = pointer.current;
        queueMicrotask(() => {
          if (pointer.current === active) {
            clearSnap();
            pointer.current = null;
          }
        });
      }}
      onValueChange={changeValues}
      onValueCommit={(next) => {
        onValueCommit?.(pointer.current ? pendingValue.current : next);
      }}
      orientation={orientation}
      step={step}
      value={values}
      {...props}
    />
  );
}

function Group({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("relative", className)} data-slot="slider-group" {...props} />;
}

function Marker({
  className,
  max = 100,
  min = 0,
  style,
  value,
  ...props
}: Omit<React.ComponentProps<"span">, "value"> & { max?: number; min?: number; value: number }) {
  const position = max === min ? 0 : (Math.min(max, Math.max(min, value)) - min) / (max - min);
  return (
    <span
      className={cn("absolute w-0", className)}
      data-slot="slider-marker"
      style={{ left: `${position * 100}%`, ...style }}
      {...props}
    />
  );
}

function Markers({
  markers = [],
  max = 100,
  min = 0,
}: Pick<React.ComponentProps<typeof Root>, "max" | "min"> & { markers?: readonly SliderMarker[] }) {
  return (
    <>
      {markers.map((marker, index) => {
        const position =
          max === min ? 0 : (Math.min(max, Math.max(min, marker.value)) - min) / (max - min);

        const isFirst = index === 0;
        const isLast = index === markers.length - 1;

        const labelAlignment =
          isLast && marker.value === max
            ? "-right-1.5 left-auto translate-x-0 text-right"
            : isFirst && marker.value === min
              ? "-left-1.5 translate-x-0"
              : "left-1/2 -translate-x-1/2";

        return (
          <span
            className="pointer-events-none absolute top-1/2 h-3 w-px -translate-1/2 bg-muted-foreground/70"
            data-slot="slider-marker"
            key={`${marker.value}-${String(marker.label)}`}
            style={{
              left: `calc(${position * 100}% + ${0.375 - position * 0.75}rem)`,
            }}
          >
            <span
              className={cn(
                "absolute bottom-full pb-0.5 text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground",
                labelAlignment,
              )}
            >
              {marker.label}
            </span>
          </span>
        );
      })}
    </>
  );
}

function Track({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Track>) {
  return (
    <SliderPrimitive.Track
      className={cn(
        "relative z-0 grow overflow-hidden bg-muted data-horizontal:w-full data-vertical:h-full",
        className,
      )}
      data-slot="slider-track"
      {...props}
    />
  );
}

function Range({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Range>) {
  return (
    <SliderPrimitive.Range
      className={cn(
        "absolute z-2 bg-primary select-none data-horizontal:h-full data-vertical:w-full",
        className,
      )}
      data-slot="slider-range"
      {...props}
    />
  );
}

function Thumb({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Thumb>) {
  return (
    <SliderPrimitive.Thumb
      className={cn(
        "relative z-10 block shrink-0 ring-ring/50 select-none after:absolute hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      data-slot="slider-thumb"
      {...props}
    />
  );
}

function Slider({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-valuetext": ariaValueText,
  className,
  defaultValue,
  disabled,
  markers = [],
  max = 100,
  min = 0,
  onPointerCancelCapture,
  onPointerDownCapture,
  onPointerUpCapture,
  value,
  ...props
}: React.ComponentProps<typeof Root> & { markers?: readonly SliderMarker[] }) {
  const [dragging, setDragging] = React.useState(false);
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <Root
      className={cn(markers.length > 0 && "py-2", className)}
      defaultValue={defaultValue}
      disabled={disabled}
      max={max}
      min={min}
      onPointerCancelCapture={(event) => {
        setDragging(false);
        onPointerCancelCapture?.(event);
      }}
      onPointerDownCapture={(event) => {
        setDragging(!disabled);
        onPointerDownCapture?.(event);
      }}
      onPointerUpCapture={(event) => {
        setDragging(false);
        onPointerUpCapture?.(event);
      }}
      value={value}
      {...props}
    >
      <Track className="rounded-full data-horizontal:h-1.5 data-vertical:w-1">
        <Range />
      </Track>

      <Markers markers={markers} max={max} min={min} />

      {Array.from({ length: _values.length }, (_, index) => (
        <Tooltip key={index} open={!disabled && dragging} preserveOnTrigger>
          <TooltipTrigger asChild>
            <Thumb
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={ariaValueText}
              className="size-3 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] after:-inset-2"
            />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            {ariaValueText ??
              markers.find((marker) => marker.value === _values[index])?.label ??
              _values[index]}
          </TooltipContent>
        </Tooltip>
      ))}
    </Root>
  );
}

Slider.Root = Root;
Slider.Group = Group;
Slider.Marker = Marker;
Slider.Markers = Markers;
Slider.Track = Track;
Slider.Range = Range;
Slider.Thumb = Thumb;

export { Slider };

export type { SliderMarker };
