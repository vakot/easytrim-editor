import { type KeyboardEvent, type PointerEvent, useRef } from "react";

import { cn } from "@/lib/class-names.utils";
import { colorFromSpectrumPosition, type HexColor, hexToHsl } from "@/lib/color.utils";

interface ColorSampleProps {
  color: string;
  selected?: boolean;
  className?: string;
}

export function ColorSample({ color, selected = false, className }: ColorSampleProps) {
  return (
    <span
      className={cn(
        "size-3 rounded-full ring-1 ring-foreground/20",
        selected && "ring-2 ring-foreground ring-offset-1 ring-offset-popover",
        className,
      )}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

interface SpectrumWheelProps {
  color: string;
  label: string;
  onPreview: (color: HexColor) => void;
  onCommit: (color: HexColor) => void;
  onCancel: () => void;
  className?: string;
}

export function SpectrumWheel({
  color,
  label,
  onPreview,
  onCommit,
  onCancel,
  className,
}: SpectrumWheelProps) {
  const wheelRef = useRef<HTMLButtonElement>(null);
  const activePointerId = useRef<number | null>(null);
  const scrubbedColor = useRef<HexColor | null>(null);

  const chooseColor = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const selectedColor = colorFromSpectrumPosition(
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      bounds.width,
    );

    scrubbedColor.current = selectedColor;
    onPreview(selectedColor);
  };

  const startScrubbing = (event: PointerEvent<HTMLButtonElement>) => {
    activePointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    chooseColor(event);
  };

  const scrubColor = (event: PointerEvent<HTMLButtonElement>) => {
    if (activePointerId.current === event.pointerId) chooseColor(event);
  };

  const stopScrubbing = (event: PointerEvent<HTMLButtonElement>, commit: boolean) => {
    if (activePointerId.current !== event.pointerId) return;
    activePointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (commit && scrubbedColor.current) onCommit(scrubbedColor.current);
    if (!commit) onCancel();
    scrubbedColor.current = null;
  };

  const adjustHue = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const bounds = wheelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const change = event.key === "ArrowRight" ? 8 : -8;
    const center = bounds.width / 2;
    const { hue: currentHue } = hexToHsl(color);
    const nextHue = (((currentHue + change) % 360) + 360) % 360;
    const angle = ((nextHue - 90) * Math.PI) / 180;
    onCommit(
      colorFromSpectrumPosition(
        center + Math.cos(angle) * center,
        center + Math.sin(angle) * center,
        bounds.width,
      ),
    );
  };

  return (
    <button
      ref={wheelRef}
      className={cn(
        "relative block size-48 touch-none cursor-crosshair rounded-full outline-none ring-1 ring-foreground/10 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      type="button"
      aria-label={label}
      onPointerDown={startScrubbing}
      onPointerMove={scrubColor}
      onPointerUp={(event) => stopScrubbing(event, true)}
      onPointerCancel={(event) => stopScrubbing(event, false)}
      onKeyDown={adjustHue}
      style={{
        background:
          "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%), conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
      }}
    >
      <span
        className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
        aria-hidden="true"
        style={colorMarkerPosition(color)}
      />
    </button>
  );
}

function colorMarkerPosition(color: string) {
  const { hue, saturation } = hexToHsl(color);
  const angle = ((hue - 90) * Math.PI) / 180;
  const radius = (saturation / 100) * 45;
  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`,
    backgroundColor: color,
  };
}
