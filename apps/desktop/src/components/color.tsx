import * as React from "react";

import { Input } from "@/components/ui/input";
import { Slot } from "@/components/ui/slot";

import { cn } from "@/lib/class-names.utils";
import type { HexColor, HsvColor } from "@/lib/color.types";
import {
  clampHue,
  clampPercent,
  hexToHsv,
  hsvFromSpectrumPosition,
  hsvToHex,
  hueFromPosition,
  isHexColor,
  positionFromHue,
  positionFromSaturation,
  positionFromValue,
} from "@/lib/color.utils";

function createColorPickerState(color: HexColor) {
  return {
    hsv: hexToHsv(color),
    hexDraft: color.slice(1),
  };
}

function ColorSample({
  className,
  color,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  color: string;
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

function ColorPicker({
  children,
  defaultValue,
  onCancel,
  onCommit,
  onPreview,
}: React.PropsWithChildren<{
  defaultValue: HexColor;
  onCancel?: () => void;
  onCommit?: (color: HexColor) => void;
  onPreview?: (color: HexColor) => void;
}>) {
  const [state, setState] = React.useState(() => createColorPickerState(defaultValue));

  function preview(nextHsv: HsvColor) {
    const color = hsvToHex(nextHsv.hue, nextHsv.saturation, nextHsv.value);

    setState({
      hsv: nextHsv,
      hexDraft: color.slice(1),
    });

    onPreview?.(color);
  }

  function commitColor(color: HexColor) {
    setState(createColorPickerState(color));
    onCommit?.(color);
  }

  function commit(nextHsv: HsvColor) {
    const color = hsvToHex(nextHsv.hue, nextHsv.saturation, nextHsv.value);
    commitColor(color);
  }

  function selectPreset(color: HexColor) {
    commitColor(color);
  }

  function cancel(previousHsv: HsvColor) {
    const color = hsvToHex(previousHsv.hue, previousHsv.saturation, previousHsv.value);

    setState({
      hsv: previousHsv,
      hexDraft: color.slice(1),
    });

    onCancel?.();
  }

  function editHex(value: string) {
    const hexDraft = value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);

    const color = `#${hexDraft.toLowerCase()}`;

    if (!isHexColor(color)) {
      setState((current) => ({
        ...current,
        hexDraft,
      }));
      return;
    }

    commitColor(color);
  }

  return (
    <ColorPickerContext.Provider
      value={{
        cancel,
        commit,
        editHex,
        hexDraft: state.hexDraft,
        hsv: state.hsv,
        preview,
        selectPreset,
      }}
    >
      {children}
    </ColorPickerContext.Provider>
  );
}

function ColorPickerSpectrum({
  "aria-label": ariaLabel,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn("space-y-3", className)}
      data-slot="color-spectrum"
      role="group"
      {...props}
    >
      <ColorPickerSaturation aria-label={ariaLabel} />
      <ColorPickerHue aria-label={ariaLabel} />
    </div>
  );
}

function ColorPickerSaturation({ "aria-label": ariaLabel }: { "aria-label"?: string }) {
  const { cancel, commit, hsv, preview } = useColorPicker();

  const pointer = usePointerScrub({
    value: hsv,
    resolve(event) {
      const bounds = event.currentTarget.getBoundingClientRect();

      return hsvFromSpectrumPosition(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        bounds.width,
        bounds.height,
        hsv.hue,
      );
    },
    onCancel: cancel,
    onCommit: commit,
    onPreview: preview,
  });

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 10 : 2;

    let saturation = hsv.saturation;
    let value = hsv.value;

    switch (event.key) {
      case "ArrowLeft":
        saturation -= step;
        break;

      case "ArrowRight":
        saturation += step;
        break;

      case "ArrowUp":
        value += step;
        break;

      case "ArrowDown":
        value -= step;
        break;

      default:
        return;
    }

    event.preventDefault();

    commit({
      ...hsv,
      saturation: clampPercent(saturation),
      value: clampPercent(value),
    });
  }

  return (
    <button
      aria-label={
        ariaLabel ? `${ariaLabel} saturation and brightness` : "Saturation and brightness"
      }
      className="relative isolate block h-48 w-full cursor-crosshair touch-none rounded-lg ring-1 ring-foreground/10 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
      data-slot="color-spectrum-field"
      onKeyDown={handleKeyDown}
      type="button"
      {...pointer}
      style={{
        background: `
          linear-gradient(to top, #000000, transparent),
          linear-gradient(to right, #ffffff, transparent),
          ${hsvToHex(hsv.hue, 100, 100)}
        `,
      }}
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
    </button>
  );
}

function ColorPickerHue({ "aria-label": ariaLabel }: { "aria-label"?: string }) {
  const { cancel, commit, hsv, preview } = useColorPicker();

  const pointer = usePointerScrub({
    value: hsv,
    resolve(event) {
      const bounds = event.currentTarget.getBoundingClientRect();

      return {
        ...hsv,
        hue: hueFromPosition(event.clientX - bounds.left, bounds.width),
      };
    },
    onCancel: cancel,
    onCommit: commit,
    onPreview: preview,
  });

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 10 : 1;
    let hue = hsv.hue;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowLeft":
        hue -= step;
        break;

      case "ArrowRight":
      case "ArrowUp":
        hue += step;
        break;

      case "Home":
        hue = 0;
        break;

      case "End":
        hue = 360;
        break;

      default:
        return;
    }

    event.preventDefault();

    commit({
      ...hsv,
      hue: clampHue(hue),
    });
  }

  return (
    <button
      aria-label={ariaLabel ? `${ariaLabel} hue` : "Hue"}
      aria-orientation="horizontal"
      aria-valuemax={360}
      aria-valuemin={0}
      aria-valuenow={hsv.hue}
      className="relative isolate block h-4 w-full touch-none rounded-full ring-1 ring-foreground/10 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring"
      data-slot="color-hue-slider"
      onKeyDown={handleKeyDown}
      role="slider"
      type="button"
      {...pointer}
      style={{
        background:
          "linear-gradient(to right, #ff0000 0%, #ffff00 16.67%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.67%, #ff00ff 83.33%, #ff0000 100%)",
      }}
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
  );
}

function ColorPickerInput({
  className,
  onChange,
  ...props
}: Omit<
  React.ComponentProps<typeof Input>,
  "defaultValue" | "maxLength" | "pattern" | "spellCheck" | "value"
>) {
  const { editHex, hexDraft } = useColorPicker();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    editHex(event.currentTarget.value);
    onChange?.(event);
  }

  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-muted-foreground"
      >
        #
      </span>

      <Input
        className="pl-5 font-mono"
        maxLength={6}
        onChange={handleChange}
        pattern="[0-9a-fA-F]{6}"
        spellCheck={false}
        value={hexDraft}
        {...props}
      />
    </div>
  );
}

function ColorPickerPreset({ children, value }: { children: React.ReactElement; value: HexColor }) {
  const { selectPreset } = useColorPicker();

  return <Slot onClick={() => selectPreset(value)}>{children}</Slot>;
}

interface PointerScrubOptions<T> {
  onCancel: (value: T) => void;
  onCommit: (value: T) => void;
  onPreview: (value: T) => void;
  resolve: (event: React.PointerEvent<HTMLButtonElement>) => T;
  value: T;
}

function usePointerScrub<T>({
  onCancel,
  onCommit,
  onPreview,
  resolve,
  value,
}: PointerScrubOptions<T>) {
  const activePointer = React.useRef<{
    id: number;
    target: HTMLButtonElement;
  } | null>(null);

  const startValue = React.useRef<T | null>(null);
  const currentValue = React.useRef<T | null>(null);

  function clear() {
    activePointer.current = null;
    startValue.current = null;
    currentValue.current = null;
  }

  function release() {
    const active = activePointer.current;

    if (active?.target.hasPointerCapture(active.id)) {
      active.target.releasePointerCapture(active.id);
    }
  }

  function cancel() {
    const initial = startValue.current;

    clear();

    if (initial !== null) {
      onCancel(initial);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.isPrimary === false || activePointer.current) {
      return;
    }

    activePointer.current = {
      id: event.pointerId,
      target: event.currentTarget,
    };

    startValue.current = value;

    event.currentTarget.setPointerCapture(event.pointerId);

    const nextValue = resolve(event);

    currentValue.current = nextValue;
    onPreview(nextValue);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const active = activePointer.current;

    if (active?.id !== event.pointerId || active.target !== event.currentTarget) {
      return;
    }

    const nextValue = resolve(event);

    currentValue.current = nextValue;
    onPreview(nextValue);
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const active = activePointer.current;

    if (active?.id !== event.pointerId || active.target !== event.currentTarget) {
      return;
    }

    const finalValue = currentValue.current;

    activePointer.current = null;
    release();

    startValue.current = null;
    currentValue.current = null;

    if (finalValue !== null) {
      onCommit(finalValue);
    }
  }

  function onPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    if (activePointer.current?.id !== event.pointerId) return;

    activePointer.current = null;
    release();
    cancel();
  }

  function onLostPointerCapture(event: React.PointerEvent<HTMLButtonElement>) {
    if (activePointer.current?.id !== event.pointerId) return;

    cancel();
  }

  React.useEffect(
    () => () => {
      release();
      clear();
    },
    [],
  );

  return {
    onLostPointerCapture,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}

interface ColorPickerContextValue {
  cancel: (value: HsvColor) => void;
  commit: (value: HsvColor) => void;
  editHex: (value: string) => void;
  hexDraft: string;
  hsv: HsvColor;
  preview: (value: HsvColor) => void;
  selectPreset: (color: HexColor) => void;
}

const ColorPickerContext = React.createContext<ColorPickerContextValue | null>(null);

function useColorPicker() {
  const context = React.useContext(ColorPickerContext);

  if (!context) {
    throw new Error("ColorPicker controls must be used within ColorPicker");
  }

  return context;
}

export { ColorPicker, ColorPickerInput, ColorPickerPreset, ColorPickerSpectrum, ColorSample };
