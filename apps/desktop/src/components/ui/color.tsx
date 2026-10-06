import * as React from "react";

import { cn } from "@/lib/class-names.utils";
import type { HexColor } from "@/lib/color.types";
import { colorFromSpectrumPosition, hexToHsv, hsvToHex, hueFromPosition } from "@/lib/color.utils";

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
  const activePointer = React.useRef<{
    id: number;
    type: "spectrum" | "hue";
  } | null>(null);

  const scrubbedColor = React.useRef<HexColor | null>(null);

  const { hue, saturation, value } = hexToHsv(color);

  function preview(nextColor: HexColor) {
    scrubbedColor.current = nextColor;
    onPreview?.(nextColor);
  }

  function chooseSpectrum(event: React.PointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    preview(
      colorFromSpectrumPosition(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        bounds.width,
        bounds.height,
        hue,
      ),
    );
  }

  function chooseHue(event: React.PointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    const nextHue = hueFromPosition(event.clientX - bounds.left, bounds.width);

    preview(hsvToHex(nextHue, saturation, value));
  }

  function startScrubbing(event: React.PointerEvent<HTMLButtonElement>, type: "spectrum" | "hue") {
    activePointer.current = {
      id: event.pointerId,
      type,
    };

    event.currentTarget.setPointerCapture(event.pointerId);

    if (type === "spectrum") {
      chooseSpectrum(event);
    } else {
      chooseHue(event);
    }
  }

  function scrub(event: React.PointerEvent<HTMLButtonElement>, type: "spectrum" | "hue") {
    const active = activePointer.current;

    if (active?.id !== event.pointerId || active.type !== type) return;

    if (type === "spectrum") {
      chooseSpectrum(event);
    } else {
      chooseHue(event);
    }
  }

  function stopScrubbing(event: React.PointerEvent<HTMLButtonElement>, commit: boolean) {
    if (activePointer.current?.id !== event.pointerId) return;

    activePointer.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (commit && scrubbedColor.current) {
      onCommit?.(scrubbedColor.current);
    } else {
      onCancel?.();
    }

    scrubbedColor.current = null;
  }

  function adjustSpectrum(event: React.KeyboardEvent<HTMLButtonElement>) {
    let nextSaturation = saturation;
    let nextValue = value;

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

    onCommit?.(
      hsvToHex(
        hue,
        Math.min(100, Math.max(0, nextSaturation)),
        Math.min(100, Math.max(0, nextValue)),
      ),
    );
  }

  function adjustHue(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();

    const change = event.key === "ArrowRight" ? 4 : -4;

    onCommit?.(hsvToHex((hue + change + 360) % 360, saturation, value));
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
            ${hsvToHex(hue, 100, 100)}
          `,
        }}
        type="button"
      >
        <span
          aria-hidden="true"
          className="absolute size-4 -translate-1/2 rounded-full border-2 border-white shadow-md"
          data-slot="color-spectrum-marker"
          style={{
            left: `${saturation}%`,
            top: `${100 - value}%`,
            backgroundColor: color,
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
            left: `${(hue / 360) * 100}%`,
            backgroundColor: hsvToHex(hue, 100, 100),
          }}
        />
      </button>
    </div>
  );
}

export { ColorSample, ColorSpectrum };
