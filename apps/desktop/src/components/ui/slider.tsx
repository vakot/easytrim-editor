"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useDragAwareDoubleClick } from "@/components/useDragAwareDoubleClick";
import { useSliderSnapping } from "@/components/useSliderSnapping";
import { cn } from "@/lib/class-names.utils";

interface SliderMarker {
  label: React.ReactNode;
  snapTarget?: boolean;
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
  const [dragging, setDragging] = React.useState(false);
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? [min]);
  const values = value ?? uncontrolledValue;
  const pendingValue = React.useRef(values);
  const snapping = useSliderSnapping({
    dir,
    inverted,
    max,
    min,
    minStepsBetweenThumbs,
    orientation,
    snap,
    snapThreshold,
    step,
  });

  function changeValues(next: number[]) {
    next = snapping.apply(next, values);
    pendingValue.current = next;
    if (value === undefined) setUncontrolledValue(next);
    onValueChange?.(next);
  }

  const dragAwareDoubleClick = useDragAwareDoubleClick<HTMLDivElement>(onDoubleClick);

  return (
    <SliderContext.Provider value={{ values, defaultValue, max, min, dragging }}>
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
          snapping.stop();
          setDragging(false);
          onLostPointerCapture?.(event);
        }}
        onPointerCancelCapture={(event) => {
          snapping.stop();
          setDragging(false);
          dragAwareDoubleClick.onPointerCancelCapture(event);
          onPointerCancelCapture?.(event);
        }}
        onPointerDownCapture={(event) => {
          if (event.button !== 0 || event.isPrimary === false) {
            event.preventDefault();
            return;
          }
          setDragging(!disabled);
          dragAwareDoubleClick.onPointerDownCapture(event);
          onPointerDownCapture?.(event);
          if (!disabled && !event.defaultPrevented && event.button === 0) {
            pendingValue.current = values;
            snapping.start(event);
          }
        }}
        onPointerMoveCapture={(event) => {
          snapping.track(event);
          dragAwareDoubleClick.onPointerMoveCapture(event);
          onPointerMoveCapture?.(event);
        }}
        onPointerUpCapture={(event) => {
          setDragging(false);
          dragAwareDoubleClick.onPointerUpCapture(event);
          onPointerUpCapture?.(event);
          snapping.release();
        }}
        onValueChange={changeValues}
        onValueCommit={(next) => {
          onValueCommit?.(snapping.active ? pendingValue.current : next);
        }}
        orientation={orientation}
        step={step}
        value={values}
        {...props}
      />
    </SliderContext.Provider>
  );
}

/** `sharedScale`: every root and marker in the group uses one value-to-position mapping. */
function Group({
  className,
  sharedScale = false,
  ...props
}: React.ComponentProps<"div"> & { sharedScale?: boolean }) {
  return (
    <div
      className={cn("relative", className)}
      data-shared-scale={sharedScale ? "" : undefined}
      data-slot="slider-group"
      {...props}
    />
  );
}

function Marker({
  children,
  className,
  snapTarget = true,
  style,
  value,
  ...props
}: Omit<React.ComponentProps<"span">, "value"> & Omit<SliderMarker, "label">) {
  const { max, min } = useSlider();
  const position = max === min ? 0 : (Math.min(max, Math.max(min, value)) - min) / (max - min);

  const isMin = value === min;
  const isMax = value === max;

  const labelAlignment = isMax
    ? "-right-0 left-auto translate-x-0 text-right"
    : isMin
      ? "-left-0 translate-x-0"
      : "left-0 -translate-x-1/2";

  return (
    <span
      className={cn(
        "pointer-events-none absolute -inset-y-0.5 w-px -translate-x-1/2 bg-muted-foreground/70",
        className,
      )}
      data-slot="slider-marker"
      data-snap-target={snapTarget ? undefined : "false"}
      data-snap-value={value}
      style={{
        left: `${position * 100}%`,
        ...style,
      }}
      {...props}
    >
      <span
        className={cn(
          "absolute bottom-full pb-0.5 text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground",
          labelAlignment,
        )}
        data-slot="slider-marker-label"
        data-slot-max={isMax ? "true" : undefined}
        data-slot-min={isMin ? "true" : undefined}
      >
        {children}
      </span>
    </span>
  );
}

function Markers({
  className,
  markers = [],
}: Pick<React.ComponentProps<typeof Root>, "className"> & {
  markers?: readonly SliderMarker[];
}) {
  return (
    <div className={cn("absolute inset-0", className)}>
      <div className="relative size-full">
        {markers.map((marker) => (
          <Marker
            key={`${marker.value}-${String(marker.label)}`}
            snapTarget={marker.snapTarget}
            value={marker.value}
          >
            {marker.label}
          </Marker>
        ))}
      </div>
    </div>
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
      {...props}
      // Snap queries rely on this slot; wrappers such as tooltip triggers must not replace it.
      data-slot="slider-thumb"
    />
  );
}

function Preview({
  children,
  disabled,
  label,
}: React.ComponentProps<typeof Tooltip> & {
  disabled?: boolean;
  label?: ((values: number[] | undefined) => React.ReactNode) | React.ReactNode;
}) {
  const { defaultValue, dragging, values } = useSlider();

  const content = typeof label === "function" ? label(values) : (label ?? values ?? defaultValue);

  return (
    <Tooltip open={!disabled && dragging} preserveOnTrigger>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {content}
      </TooltipContent>
    </Tooltip>
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
  value,
  ...props
}: React.ComponentProps<typeof Root> & { markers?: readonly SliderMarker[] }) {
  const thumbValues = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max];

  return (
    <Root
      className={cn(markers.length > 0 && "py-2", className)}
      defaultValue={defaultValue}
      disabled={disabled}
      max={max}
      min={min}
      value={value}
      {...props}
    >
      <Track className="rounded-full data-horizontal:h-1.5 data-vertical:w-1">
        <Range />
      </Track>

      <Markers
        className="inset-1.5 [&_[data-slot=slider-marker-label][data-slot-max=true]]:-right-1.5 [&_[data-slot=slider-marker-label][data-slot-min=true]]:-left-1.5"
        markers={markers}
      />

      {thumbValues.map((thumbValue, index) => (
        <Preview
          disabled={disabled}
          key={index}
          label={
            ariaValueText ??
            markers.find((marker) => marker.value === thumbValue)?.label ??
            String(thumbValue)
          }
        >
          <Thumb
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-valuetext={ariaValueText}
            className="size-3 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] after:-inset-2"
          />
        </Preview>
      ))}
    </Root>
  );
}

const SliderContext = React.createContext<{
  defaultValue: number[] | undefined;
  dragging: boolean;
  max: number;
  min: number;
  values: number[] | undefined;
} | null>(null);

function useSlider() {
  const context = React.useContext(SliderContext);
  if (!context) {
    throw new Error("Slider parts must be used within Slider.Root");
  }
  return context;
}

Slider.Root = Root;
Slider.Group = Group;
Slider.Marker = Marker;
Slider.Markers = Markers;
Slider.Track = Track;
Slider.Range = Range;
Slider.Thumb = Thumb;
Slider.Preview = Preview;

export { Slider };

export type { SliderMarker };
