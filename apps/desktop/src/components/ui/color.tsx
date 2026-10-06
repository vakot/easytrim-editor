import * as React from "react";

import { cn } from "@/lib/class-names.utils";
import type { HexColor } from "@/lib/color.types";
import {
  clampHue,
  clampPercent,
  hexToHsv,
  hsvFromSpectrumPosition,
  hsvToHex,
  hueFromPosition,
  positionFromHue,
  positionFromSaturation,
  positionFromValue,
} from "@/lib/color.utils";

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

interface ColorSpectrumProps extends Omit<
  React.ComponentProps<"div">,
  "aria-label" | "color" | "role"
> {
  "aria-label": string;
  color: HexColor;
  formatHueValue?: (hue: number) => string;
  formatSpectrumValue?: (saturation: number, value: number) => string;
  hueLabel?: string;
  onCancel?: () => void;
  onCommit?: (color: HexColor) => void;
  onPreview?: (color: HexColor) => void;
  spectrumRoleDescription?: string;
  spectrumLabel?: string;
}

function ColorSpectrum({
  className,
  "aria-label": ariaLabel,
  color,
  formatHueValue = (hue) => `${Math.round(hue)}°`,
  formatSpectrumValue = (saturation, value) =>
    `Saturation ${Math.round(saturation)}%; brightness ${Math.round(value)}%`,
  hueLabel = "Hue",
  onCancel,
  onCommit,
  onPreview,
  spectrumRoleDescription = "two-dimensional color selector",
  spectrumLabel = "Saturation and brightness",
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
  const spectrumValueId = React.useId();

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
    const active = activePointer.current;
    activePointer.current = null;
    interactionStart.current = null;
    scrubbedColor.current = null;
    if (active?.target.hasPointerCapture(active.id)) {
      active.target.releasePointerCapture(active.id);
    }
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
    if (event.button !== 0 || event.isPrimary === false || activePointer.current) return;

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
    releasePointer(active);

    if (commit && scrubbedColor.current) {
      onCommit?.(scrubbedColor.current);
    } else {
      restoreInteraction();
    }

    scrubbedColor.current = null;
    interactionStart.current = null;
  }

  function releasePointer(active: NonNullable<typeof activePointer.current>) {
    if (active.target.hasPointerCapture(active.id)) {
      active.target.releasePointerCapture(active.id);
    }
  }

  function restoreInteraction() {
    const startingHsv = interactionStart.current;
    interactionStart.current = null;
    scrubbedColor.current = null;
    if (startingHsv) updateHsv(startingHsv);
    onCancel?.();
  }

  function losePointerCapture(event: React.PointerEvent<HTMLButtonElement>) {
    const active = activePointer.current;
    if (active?.id !== event.pointerId || active.target !== event.currentTarget) return;

    activePointer.current = null;
    restoreInteraction();
  }

  function adjustSpectrum(event: React.KeyboardEvent<HTMLButtonElement>) {
    const current = hsvRef.current;
    let nextSaturation = current.saturation;
    let nextValue = current.value;
    const step = event.shiftKey ? 10 : 2;

    switch (event.key) {
      case "ArrowLeft":
        nextSaturation -= step;
        break;
      case "ArrowRight":
        nextSaturation += step;
        break;
      case "ArrowUp":
        nextValue += step;
        break;
      case "ArrowDown":
        nextValue -= step;
        break;
      default:
        return;
    }

    event.preventDefault();

    commit({
      ...current,
      saturation: clampPercent(nextSaturation),
      value: clampPercent(nextValue),
    });
  }

  function adjustHue(event: React.KeyboardEvent<HTMLButtonElement>) {
    const current = hsvRef.current;
    const step = event.shiftKey ? 10 : 1;
    let nextHue: number;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowLeft":
        nextHue = current.hue - step;
        break;
      case "ArrowRight":
      case "ArrowUp":
        nextHue = current.hue + step;
        break;
      case "Home":
        nextHue = 0;
        break;
      case "End":
        nextHue = 360;
        break;
      default:
        return;
    }

    event.preventDefault();
    commit({ ...current, hue: clampHue(nextHue) });
  }

  function commit(nextHsv: typeof hsv) {
    updateHsv(nextHsv);
    const nextColor = hsvToHex(nextHsv.hue, nextHsv.saturation, nextHsv.value);
    emittedColor.current = nextColor;
    onCommit?.(nextColor);
  }

  React.useEffect(
    () => () => {
      const active = activePointer.current;
      activePointer.current = null;
      if (active?.target.hasPointerCapture(active.id)) {
        active.target.releasePointerCapture(active.id);
      }
    },
    [],
  );

  const formattedSpectrumValue = formatSpectrumValue(hsv.saturation, hsv.value);

  return (
    <div
      {...props}
      aria-label={ariaLabel}
      className={cn("w-84 space-y-3", className)}
      data-slot="color-spectrum"
      role="group"
    >
      <button
        aria-describedby={spectrumValueId}
        aria-label={spectrumLabel}
        aria-keyshortcuts="ArrowDown ArrowLeft ArrowRight ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp"
        aria-roledescription={spectrumRoleDescription}
        className="relative isolate block h-48 w-full cursor-crosshair touch-none rounded-lg ring-1 ring-foreground/10 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
        data-slot="color-spectrum-field"
        onLostPointerCapture={losePointerCapture}
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
          className="absolute size-4 -translate-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/80"
          data-slot="color-spectrum-marker"
          style={{
            left: `${positionFromSaturation(hsv.saturation) * 100}%`,
            top: `${positionFromValue(hsv.value) * 100}%`,
            backgroundColor: hsvToHex(hsv.hue, hsv.saturation, hsv.value),
          }}
        />
        <span className="sr-only" id={spectrumValueId}>
          {formattedSpectrumValue}
        </span>
      </button>

      <button
        aria-label={hueLabel}
        aria-keyshortcuts="ArrowDown ArrowLeft ArrowRight ArrowUp Home End Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp"
        aria-orientation="horizontal"
        aria-valuemax={360}
        aria-valuemin={0}
        aria-valuenow={hsv.hue}
        aria-valuetext={formatHueValue(Math.round(hsv.hue))}
        className="relative isolate block h-4 w-full touch-none rounded-full ring-1 ring-foreground/10 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
        data-slot="color-hue-slider"
        onLostPointerCapture={losePointerCapture}
        onKeyDown={adjustHue}
        onPointerCancel={(event) => stopScrubbing(event, false)}
        onPointerDown={(event) => startScrubbing(event, "hue")}
        onPointerMove={(event) => scrub(event, "hue")}
        onPointerUp={(event) => stopScrubbing(event, true)}
        role="slider"
        style={{
          background:
            "linear-gradient(to right, #ff0000 0%, #ffff00 16.67%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.67%, #ff00ff 83.33%, #ff0000 100%)",
        }}
        type="button"
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-5 -translate-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/80"
          data-slot="color-hue-marker"
          style={{
            left: `${positionFromHue(hsv.hue) * 100}%`,
            backgroundColor: hsvToHex(hsv.hue, 100, 100),
          }}
        />
      </button>
    </div>
  );
}

export { ColorSample, ColorSpectrum };
