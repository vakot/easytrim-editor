import * as React from "react";

import { cn } from "@/lib/class-names.utils";
import type { HexColor } from "@/lib/color.types";
import { hexToHsv, hsvFromSpectrumPosition, hsvToHex, hueFromPosition } from "@/lib/color.utils";

function ColorSample({
  className,
  color,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  color: string;
  selected?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-3 rounded-full ring-1 ring-foreground/20", className)}
      data-slot="color-sample"
      style={{
        backgroundColor: color,
        ...style,
      }}
      {...props}
    />
  );
}

interface ColorSpectrumProps extends Omit<React.ComponentProps<"div">, "color"> {
  color: string;
  onCancel?: () => void;
  onCommit?: (color: HexColor) => void;
  onPreview?: (color: HexColor) => void;
}

function ColorSpectrum({
  className,
  color,
  onCancel,
  onCommit,
  onPreview,
  ...props
}: ColorSpectrumProps) {
  const [hsv, setHsv] = React.useState(() => hexToHsv(color));
  const hsvRef = React.useRef(hsv);
  const previousColor = React.useRef(color);
  const emittedColor = React.useRef<HexColor | null>(null);
  const activePointer = React.useRef<{
    id: number;
    target: HTMLButtonElement;
    type: "spectrum" | "hue";
  } | null>(null);

  const scrubbedColor = React.useRef<HexColor | null>(null);
  const interactionStart = React.useRef<typeof hsv | null>(null);

  const updateHsv = React.useCallback((nextHsv: typeof hsv) => {
    hsvRef.current = nextHsv;
    setHsv(nextHsv);
  }, []);

  // HEX echoes cannot preserve hue at 360° or when saturation/value is zero.
  React.useLayoutEffect(() => {
    if (previousColor.current === color) return;

    previousColor.current = color;
    if (emittedColor.current === color) {
      emittedColor.current = null;
      return;
    }

    emittedColor.current = null;
    updateHsv(hexToHsv(color));
  }, [color, updateHsv]);

  function preview(nextHsv: typeof hsv) {
    updateHsv(nextHsv);
    const nextColor = hsvToHex(nextHsv.hue, nextHsv.saturation, nextHsv.value);
    emittedColor.current = nextColor;
    scrubbedColor.current = nextColor;
    onPreview?.(nextColor);
  }

  function chooseSpectrum(event: React.PointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    preview(
      hsvFromSpectrumPosition(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        bounds.width,
        bounds.height,
        hsvRef.current.hue,
      ),
    );
  }

  function chooseHue(event: React.PointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const current = hsvRef.current;
    preview({
      ...current,
      hue: hueFromPosition(event.clientX - bounds.left, bounds.width),
    });
  }

  function startScrubbing(event: React.PointerEvent<HTMLButtonElement>, type: "spectrum" | "hue") {
    const active = activePointer.current;
    if (active?.target.hasPointerCapture(active.id)) {
      active.target.releasePointerCapture(active.id);
    }

    activePointer.current = {
      id: event.pointerId,
      target: event.currentTarget,
      type,
    };
    interactionStart.current = hsvRef.current;
    scrubbedColor.current = null;

    event.currentTarget.setPointerCapture(event.pointerId);

    if (type === "spectrum") {
      chooseSpectrum(event);
    } else {
      chooseHue(event);
    }
  }

  function scrub(event: React.PointerEvent<HTMLButtonElement>, type: "spectrum" | "hue") {
    const active = activePointer.current;

    if (
      active?.id !== event.pointerId ||
      active.type !== type ||
      active.target !== event.currentTarget
    )
      return;

    if (type === "spectrum") {
      chooseSpectrum(event);
    } else {
      chooseHue(event);
    }
  }

  function stopScrubbing(event: React.PointerEvent<HTMLButtonElement>, commit: boolean) {
    const active = activePointer.current;
    if (active?.id !== event.pointerId || active.target !== event.currentTarget) return;

    activePointer.current = null;

    if (active.target.hasPointerCapture(event.pointerId)) {
      active.target.releasePointerCapture(event.pointerId);
    }

    if (commit && scrubbedColor.current) {
      onCommit?.(scrubbedColor.current);
    } else {
      if (interactionStart.current) updateHsv(interactionStart.current);
      onCancel?.();
    }

    scrubbedColor.current = null;
    interactionStart.current = null;
  }

  function adjustSpectrum(event: React.KeyboardEvent<HTMLButtonElement>) {
    const current = hsvRef.current;
    let nextSaturation = current.saturation;
    let nextValue = current.value;

    switch (event.key) {
      case "ArrowLeft":
        nextSaturation -= 2;
        break;
      case "ArrowRight":
        nextSaturation += 2;
        break;
      case "ArrowUp":
        nextValue += 2;
        break;
      case "ArrowDown":
        nextValue -= 2;
        break;
      default:
        return;
    }

    event.preventDefault();

    commit({
      ...current,
      saturation: Math.min(100, Math.max(0, nextSaturation)),
      value: Math.min(100, Math.max(0, nextValue)),
    });
  }

  function adjustHue(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const change = event.key === "ArrowRight" ? 4 : -4;
    const current = hsvRef.current;
    commit({ ...current, hue: Math.min(360, Math.max(0, current.hue + change)) });
  }

  function commit(nextHsv: typeof hsv) {
    updateHsv(nextHsv);
    const nextColor = hsvToHex(nextHsv.hue, nextHsv.saturation, nextHsv.value);
    emittedColor.current = nextColor;
    onCommit?.(nextColor);
  }

  return (
    <div className={cn("w-84 space-y-3", className)} data-slot="color-spectrum" {...props}>
      <button
        aria-label="Color saturation and brightness"
        className="relative block h-48 w-full cursor-crosshair touch-none overflow-hidden rounded-lg ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-slot="color-spectrum-field"
        onKeyDown={adjustSpectrum}
        onPointerCancel={(event) => stopScrubbing(event, false)}
        onPointerDown={(event) => startScrubbing(event, "spectrum")}
        onPointerMove={(event) => scrub(event, "spectrum")}
        onPointerUp={(event) => stopScrubbing(event, true)}
        style={{
          background: `
            linear-gradient(to top, #000000, transparent),
            linear-gradient(to right, #ffffff, transparent),
            ${hsvToHex(hsv.hue, 100, 100)}
          `,
        }}
        type="button"
      >
        <span
          aria-hidden="true"
          className="absolute size-4 -translate-1/2 rounded-full border-2 border-white shadow-md"
          data-slot="color-spectrum-marker"
          style={{
            left: `${hsv.saturation}%`,
            top: `${100 - hsv.value}%`,
            backgroundColor: hsvToHex(hsv.hue, hsv.saturation, hsv.value),
          }}
        />
      </button>

      <button
        aria-label="Color hue"
        className="relative block h-4 w-full touch-none rounded-full ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-slot="color-hue-slider"
        onKeyDown={adjustHue}
        onPointerCancel={(event) => stopScrubbing(event, false)}
        onPointerDown={(event) => startScrubbing(event, "hue")}
        onPointerMove={(event) => scrub(event, "hue")}
        onPointerUp={(event) => stopScrubbing(event, true)}
        style={{
          background:
            "linear-gradient(to right, #ff0000 0%, #ffff00 16.67%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.67%, #ff00ff 83.33%, #ff0000 100%)",
        }}
        type="button"
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-5 -translate-1/2 rounded-full border-2 border-white shadow-md"
          data-slot="color-hue-marker"
          style={{
            left: `${(hsv.hue / 360) * 100}%`,
            backgroundColor: hsvToHex(hsv.hue, 100, 100),
          }}
        />
      </button>
    </div>
  );
}

export { ColorSample, ColorSpectrum };
