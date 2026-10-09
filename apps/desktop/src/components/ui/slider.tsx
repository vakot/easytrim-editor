"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { cn } from "@/lib/class-names.utils";

interface SliderMarker {
  label: React.ReactNode;
  value: number;
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
}: React.ComponentProps<typeof SliderPrimitive.Root> & { markers?: readonly SliderMarker[] }) {
  const [dragging, setDragging] = React.useState(false);
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative isolate flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        markers.length > 0 && "py-2",
        className,
      )}
      data-slot="slider"
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
      <SliderPrimitive.Track
        className="relative z-0 grow overflow-hidden rounded-full bg-muted data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        data-slot="slider-track"
      >
        <SliderPrimitive.Range
          className="absolute z-2 bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          data-slot="slider-range"
        />
      </SliderPrimitive.Track>
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

      {Array.from({ length: _values.length }, (_, index) => (
        <Tooltip key={index} open={!disabled && dragging} preserveOnTrigger>
          <TooltipTrigger asChild>
            <SliderPrimitive.Thumb
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              aria-valuetext={ariaValueText}
              className="relative z-10 block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
              data-slot="slider-thumb"
            />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            {ariaValueText ??
              markers.find((marker) => marker.value === _values[index])?.label ??
              _values[index]}
          </TooltipContent>
        </Tooltip>
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };

export type { SliderMarker };
