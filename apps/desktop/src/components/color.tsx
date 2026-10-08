"use client";

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

interface ColorPickerState {
  hexDraft: string;
  hsv: HsvColor;
}

function createColorPickerState(color: HexColor): ColorPickerState {
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
  onChange,
  onCommit,
}: React.PropsWithChildren<{
  defaultValue: HexColor;
  onChange?: (color: HexColor) => void;
  onCommit?: (color: HexColor) => void;
}>) {
  const [state, setState] = React.useState(() => createColorPickerState(defaultValue));
  const committedState = React.useRef(state);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  function colorForState(nextState: ColorPickerState) {
    const { hue, saturation, value } = nextState.hsv;
    return hsvToHex(hue, saturation, value);
  }

  function changeHsv(nextHsv: HsvColor) {
    const color = hsvToHex(nextHsv.hue, nextHsv.saturation, nextHsv.value);

    setState({
      hsv: nextHsv,
      hexDraft: color.slice(1),
    });

    onChange?.(color);
  }

  function commitHsv(nextHsv: HsvColor) {
    const color = hsvToHex(nextHsv.hue, nextHsv.saturation, nextHsv.value);
    const nextState = { hsv: nextHsv, hexDraft: color.slice(1) };

    setState(nextState);
    committedState.current = nextState;
    onChange?.(color);
    onCommit?.(color);
  }

  function commitPointerHsv(nextHsv: HsvColor) {
    const color = hsvToHex(nextHsv.hue, nextHsv.saturation, nextHsv.value);
    const nextState = { hsv: nextHsv, hexDraft: color.slice(1) };

    setState(nextState);
    committedState.current = nextState;
    onCommit?.(color);
  }

  function commitColor(color: HexColor) {
    const nextState = createColorPickerState(color);

    setState(nextState);
    committedState.current = nextState;
    onChange?.(color);
    onCommit?.(color);
  }

  function selectPreset(color: HexColor) {
    commitColor(color);
  }

  function cancel() {
    setState(committedState.current);
    restoreCommittedValue();
  }

  function restoreCommittedValue() {
    onChangeRef.current?.(colorForState(committedState.current));
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
        changeHsv,
        commitHsv,
        commitPointerHsv,
        editHex,
        hexDraft: state.hexDraft,
        hsv: state.hsv,
        onUnmount: restoreCommittedValue,
        selectPreset,
      }}
    >
      {children}
    </ColorPickerContext.Provider>
  );
}

function ColorPickerSpectrum({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("space-y-3", className)}
      data-slot="color-spectrum"
      role="group"
      {...props}
    />
  );
}

function ColorPickerSaturationValue({
  "aria-label": ariaLabel,
  className,
  onKeyDown,
  onLostPointerCapture,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  style,
  ...props
}: Omit<React.ComponentProps<"button">, "role" | "type">) {
  const { cancel, changeHsv, commitHsv, commitPointerHsv, hsv, onUnmount } = useColorPicker();

  const pointer = usePointerScrub({
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
    onUnmount,
    onCommit: commitPointerHsv,
    onChange: changeHsv,
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

    commitHsv({
      ...hsv,
      saturation: clampPercent(saturation),
      value: clampPercent(value),
    });
  }

  return (
    <button
      {...props}
      aria-label={ariaLabel}
      className={cn(
        "relative isolate block h-48 w-full cursor-crosshair touch-none rounded-lg ring-1 ring-foreground/10 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      data-slot="color-spectrum-field"
      onKeyDown={(event) => {
        handleKeyDown(event);
        onKeyDown?.(event);
      }}
      onLostPointerCapture={(event) => {
        pointer.onLostPointerCapture(event);
        onLostPointerCapture?.(event);
      }}
      onPointerCancel={(event) => {
        pointer.onPointerCancel(event);
        onPointerCancel?.(event);
      }}
      onPointerDown={(event) => {
        pointer.onPointerDown(event);
        onPointerDown?.(event);
      }}
      onPointerMove={(event) => {
        pointer.onPointerMove(event);
        onPointerMove?.(event);
      }}
      onPointerUp={(event) => {
        pointer.onPointerUp(event);
        onPointerUp?.(event);
      }}
      style={{
        background: `
          linear-gradient(to top, #000000, transparent),
          linear-gradient(to right, #ffffff, transparent),
          ${hsvToHex(hsv.hue, 100, 100)}
        `,
        ...style,
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
    </button>
  );
}

function ColorPickerHue({
  "aria-label": ariaLabel,
  className,
  onKeyDown,
  onLostPointerCapture,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  style,
  ...props
}: Omit<
  React.ComponentProps<"button">,
  "aria-orientation" | "aria-valuemax" | "aria-valuemin" | "aria-valuenow" | "role" | "type"
>) {
  const { cancel, changeHsv, commitHsv, commitPointerHsv, hsv, onUnmount } = useColorPicker();

  const pointer = usePointerScrub({
    resolve(event) {
      const bounds = event.currentTarget.getBoundingClientRect();

      return {
        ...hsv,
        hue: hueFromPosition(event.clientX - bounds.left, bounds.width),
      };
    },
    onCancel: cancel,
    onUnmount,
    onCommit: commitPointerHsv,
    onChange: changeHsv,
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

    commitHsv({
      ...hsv,
      hue: clampHue(hue),
    });
  }

  return (
    <button
      {...props}
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      aria-valuemax={360}
      aria-valuemin={0}
      aria-valuenow={hsv.hue}
      className={cn(
        "relative isolate block h-4 w-full touch-none rounded-full ring-1 ring-foreground/10 outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      data-slot="color-hue-slider"
      onKeyDown={(event) => {
        handleKeyDown(event);
        onKeyDown?.(event);
      }}
      onLostPointerCapture={(event) => {
        pointer.onLostPointerCapture(event);
        onLostPointerCapture?.(event);
      }}
      onPointerCancel={(event) => {
        pointer.onPointerCancel(event);
        onPointerCancel?.(event);
      }}
      onPointerDown={(event) => {
        pointer.onPointerDown(event);
        onPointerDown?.(event);
      }}
      onPointerMove={(event) => {
        pointer.onPointerMove(event);
        onPointerMove?.(event);
      }}
      onPointerUp={(event) => {
        pointer.onPointerUp(event);
        onPointerUp?.(event);
      }}
      role="slider"
      style={{
        background:
          "linear-gradient(to right, #ff0000 0%, #ffff00 16.67%, #00ff00 33.33%, #00ffff 50%, #0000ff 66.67%, #ff00ff 83.33%, #ff0000 100%)",
        ...style,
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
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-muted-foreground"
      >
        #
      </span>

      <Input
        className={cn("pl-5 font-mono", className)}
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
  onCancel: () => void;
  onChange: (value: T) => void;
  onCommit: (value: T) => void;
  onUnmount: () => void;
  resolve: (event: React.PointerEvent<HTMLButtonElement>) => T;
}

function usePointerScrub<T>({
  onCancel,
  onChange,
  onCommit,
  onUnmount,
  resolve,
}: PointerScrubOptions<T>) {
  const onUnmountRef = React.useRef(onUnmount);
  React.useLayoutEffect(() => {
    onUnmountRef.current = onUnmount;
  }, [onUnmount]);

  const activePointer = React.useRef<{
    id: number;
    target: HTMLButtonElement;
  } | null>(null);

  const currentValue = React.useRef<T | null>(null);

  function clear() {
    activePointer.current = null;
    currentValue.current = null;
  }

  function release(active = activePointer.current) {
    if (active?.target.hasPointerCapture(active.id)) {
      active.target.releasePointerCapture(active.id);
    }
  }

  function cancel() {
    clear();
    onCancel();
  }

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || event.isPrimary === false || activePointer.current) {
      return;
    }

    activePointer.current = {
      id: event.pointerId,
      target: event.currentTarget,
    };

    event.currentTarget.setPointerCapture(event.pointerId);

    const nextValue = resolve(event);

    currentValue.current = nextValue;
    onChange(nextValue);
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const active = activePointer.current;

    if (active?.id !== event.pointerId || active.target !== event.currentTarget) {
      return;
    }

    const nextValue = resolve(event);

    currentValue.current = nextValue;
    onChange(nextValue);
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const active = activePointer.current;

    if (active?.id !== event.pointerId || active.target !== event.currentTarget) {
      return;
    }

    const finalValue = currentValue.current;
    const pointer = activePointer.current;

    activePointer.current = null;
    release(pointer);

    currentValue.current = null;

    if (finalValue !== null) {
      onCommit(finalValue);
    }
  }

  function onPointerCancel(event: React.PointerEvent<HTMLButtonElement>) {
    const active = activePointer.current;
    if (active?.id !== event.pointerId) return;

    activePointer.current = null;
    release(active);
    cancel();
  }

  function onLostPointerCapture(event: React.PointerEvent<HTMLButtonElement>) {
    if (activePointer.current?.id !== event.pointerId) return;

    cancel();
  }

  React.useLayoutEffect(
    () => () => {
      const active = activePointer.current;
      const interactionWasActive = active !== null;
      clear();
      release(active);
      if (interactionWasActive) onUnmountRef.current();
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
  cancel: () => void;
  changeHsv: (value: HsvColor) => void;
  commitHsv: (value: HsvColor) => void;
  commitPointerHsv: (value: HsvColor) => void;
  editHex: (value: string) => void;
  hexDraft: string;
  hsv: HsvColor;
  onUnmount: () => void;
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

export {
  ColorPicker,
  ColorPickerHue,
  ColorPickerInput,
  ColorPickerPreset,
  ColorPickerSaturationValue,
  ColorPickerSpectrum,
  ColorSample,
};
