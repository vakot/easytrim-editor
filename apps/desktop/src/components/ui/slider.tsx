import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export interface SliderMarker {
  value: number;
  label: React.ReactNode;
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  markers = [],
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { markers?: readonly SliderMarker[] }) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        markers.length > 0 && "py-2",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-full bg-muted data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full"
        />
      </SliderPrimitive.Track>
      {markers.map((marker) => {
        const position =
          max === min ? 0 : (Math.min(max, Math.max(min, marker.value)) - min) / (max - min);
        return (
          <span
            className="pointer-events-none absolute inset-y-1/4 z-1 w-px -translate-x-1/2 bg-muted-foreground/70"
            key={`${marker.value}-${String(marker.label)}`}
            style={{
              left: `calc(${position * 100}% + ${0.375 - position * 0.75}rem)`,
            }}
          >
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap pb-0.5 text-[0.625rem] leading-none text-muted-foreground">
              {marker.label}
            </span>
          </span>
        );
      })}
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="relative block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
