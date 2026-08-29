import * as React from "react";

import { cn } from "@/lib/class-names.utils";
import type { HexColor } from "@/lib/color.types";
import { colorFromSpectrumPosition, hexToHsl } from "@/lib/color.utils";

function ColorSample({
  className,
  color,
  selected = false,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  color: string;
  selected?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-3 rounded-full ring-1 ring-foreground/20",
        selected && "ring-2 ring-foreground ring-offset-1 ring-offset-popover",
        className,
      )}
      data-slot="color-sample"
      style={{
        backgroundColor: color,
        ...style,
      }}
      {...props}
    />
  );
}

function SpectrumWheel({
  className,
  color,
  onCancel,
  onCommit,
  onKeyDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPreview,
  style,
  ...props
}: React.ComponentProps<"button"> & {
  color: string;
  onCancel?: () => void;
  onCommit?: (color: HexColor) => void;
  onPreview?: (color: HexColor) => void;
}) {
  const wheelRef = React.useRef<HTMLButtonElement>(null);
  const activePointerId = React.useRef<number | null>(null);
  const scrubbedColor = React.useRef<HexColor | null>(null);

  function chooseColor(event: React.PointerEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    const selectedColor = colorFromSpectrumPosition(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      bounds.width,
    );

    scrubbedColor.current = selectedColor;
    onPreview?.(selectedColor);
  }

  function startScrubbing(event: React.PointerEvent<HTMLButtonElement>) {
    activePointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    chooseColor(event);
  }

  function scrubColor(event: React.PointerEvent<HTMLButtonElement>) {
    if (activePointerId.current === event.pointerId) {
      chooseColor(event);
    }
  }

  function stopScrubbing(event: React.PointerEvent<HTMLButtonElement>, commit: boolean) {
    if (activePointerId.current !== event.pointerId) return;

    activePointerId.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (commit && scrubbedColor.current) {
      onCommit?.(scrubbedColor.current);
    } else if (!commit) {
      onCancel?.();
    }

    scrubbedColor.current = null;
  }

  function adjustHue(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();

    const bounds = wheelRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const change = event.key === "ArrowRight" ? 8 : -8;
    const center = bounds.width / 2;

    const { hue } = hexToHsl(color);
    const nextHue = (((hue + change) % 360) + 360) % 360;
    const angle = ((nextHue - 90) * Math.PI) / 180;

    onCommit?.(
      colorFromSpectrumPosition(
        center + Math.cos(angle) * center,
        center + Math.sin(angle) * center,
        bounds.width,
      ),
    );
  }

  return (
    <button
      className={cn(
        "relative block size-48 cursor-crosshair touch-none rounded-full ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      data-slot="spectrum-wheel"
      onKeyDown={(event) => {
        adjustHue(event);
        onKeyDown?.(event);
      }}
      onPointerCancel={(event) => {
        stopScrubbing(event, false);
        onPointerCancel?.(event);
      }}
      onPointerDown={(event) => {
        startScrubbing(event);
        onPointerDown?.(event);
      }}
      onPointerMove={(event) => {
        scrubColor(event);
        onPointerMove?.(event);
      }}
      onPointerUp={(event) => {
        stopScrubbing(event, true);
        onPointerUp?.(event);
      }}
      ref={wheelRef}
      style={{
        background:
          "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%), conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        ...style,
      }}
      type="button"
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute size-4 -translate-1/2 rounded-full border-2 border-white shadow-md"
        data-slot="spectrum-wheel-marker"
        style={getColorMarkerStyle(color)}
      />
    </button>
  );
}

function getColorMarkerStyle(color: string): React.CSSProperties {
  const { hue, saturation } = hexToHsl(color);
  const angle = ((hue - 90) * Math.PI) / 180;
  const radius = (saturation / 100) * 45;

  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`,
    backgroundColor: color,
  };
}

export { ColorSample, SpectrumWheel };
