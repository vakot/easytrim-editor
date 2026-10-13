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
  disabled,
  max = 100,
  min = 0,
  onDoubleClick,
  onPointerCancelCapture,
  onPointerDownCapture,
  onPointerMoveCapture,
  onPointerUpCapture,
  value,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const dragAwareDoubleClick = useDragAwareDoubleClick<HTMLDivElement>(onDoubleClick);

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative isolate flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className,
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      disabled={disabled}
      max={max}
      min={min}
      onDoubleClick={dragAwareDoubleClick.onDoubleClick}
      onPointerCancelCapture={(event) => {
        dragAwareDoubleClick.onPointerCancelCapture(event);
        onPointerCancelCapture?.(event);
      }}
      onPointerDownCapture={(event) => {
        dragAwareDoubleClick.onPointerDownCapture(event);
        onPointerDownCapture?.(event);
      }}
      onPointerMoveCapture={(event) => {
        dragAwareDoubleClick.onPointerMoveCapture(event);
        onPointerMoveCapture?.(event);
      }}
      onPointerUpCapture={(event) => {
        dragAwareDoubleClick.onPointerUpCapture(event);
        onPointerUpCapture?.(event);
      }}
      value={value}
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
Slider.Markers = Markers;
Slider.Track = Track;
Slider.Range = Range;
Slider.Thumb = Thumb;

export { Slider };

export type { SliderMarker };
