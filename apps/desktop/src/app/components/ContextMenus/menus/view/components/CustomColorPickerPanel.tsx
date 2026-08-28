import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  customPrimaryColorChanged,
  selectCustomPrimaryColor,
} from "@/app/store/slices/theme-slice";
import { isCustomPrimaryColor, resolvePrimaryColor, type PrimaryColor } from "@/app/theme/theme";
import { useTheme } from "@/app/theme/use-theme";
import { Input } from "@/components/ui/input";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

import { colorFromSpectrumPosition } from "@/app/theme/theme";

interface CustomColorPickerPanelProps {
  previewColor: PrimaryColor | null;
  onPreviewChange: (color: PrimaryColor | null) => void;
  onClose: () => void;
}

export function CustomColorPickerPanel({
  previewColor,
  onPreviewChange,
  onClose,
}: CustomColorPickerPanelProps) {
  const { t } = useTranslation();
  const { previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();
  const customPrimaryColor = useAppSelector(selectCustomPrimaryColor);

  const [hexValue, setHexValue] = useState<string>(customPrimaryColor.slice(1));
  const selectedColor = resolvePrimaryColor(previewColor ?? customPrimaryColor);

  const preview = (color: PrimaryColor) => {
    onPreviewChange(color);
    setHexValue(resolvePrimaryColor(color).slice(1));
    previewPrimaryColor(color);
  };
  const commit = (color: PrimaryColor) => {
    onPreviewChange(null);
    setHexValue(resolvePrimaryColor(color).slice(1));
    if (isCustomPrimaryColor(color)) dispatch(customPrimaryColorChanged(color));
  };
  const cancel = () => {
    onPreviewChange(null);
    setHexValue(customPrimaryColor.slice(1));
    previewPrimaryColor(null);
  };
  const updateHexValue = (value: string) => {
    setHexValue(value);
    const color = `#${value}`;
    if (isCustomPrimaryColor(color)) commit(color);
  };

  return (
    <div className="w-auto space-y-3 p-2" onPointerMove={(event) => event.stopPropagation()}>
      <SpectrumWheel
        color={selectedColor}
        onPreview={preview}
        onCommit={commit}
        onCancel={cancel}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t("themeColor.custom")}</span>
        <div className="flex h-6 w-15 items-center rounded-lg border border-input bg-transparent px-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none shrink-0 font-mono text-xs text-muted-foreground"
            data-slot="hex-prefix"
          >
            #
          </span>
          <Input
            aria-label={`${t("themeColor.custom")} hex`}
            className="h-full w-auto min-w-0 flex-1 rounded-none border-0 px-0 py-0 font-mono text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
            maxLength={6}
            onChange={(event) =>
              updateHexValue(event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
            }
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const color = `#${hexValue}`;
              if (isCustomPrimaryColor(color)) commit(color);
              onClose();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            pattern="[0-9a-fA-F]{6}"
            spellCheck={false}
            value={hexValue}
          />
        </div>
      </div>
    </div>
  );
}

export function SpectrumWheel({
  color,
  onPreview,
  onCommit,
  onCancel,
}: {
  color: string;
  onPreview: (color: PrimaryColor) => void;
  onCommit: (color: PrimaryColor) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const wheelRef = useRef<HTMLButtonElement>(null);
  const activePointerId = useRef<number | null>(null);
  const scrubbedColor = useRef<PrimaryColor | null>(null);

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
    const { hue: currentHue } = colorToHsl(color);
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
      className="relative block size-48 touch-none cursor-crosshair rounded-full outline-none ring-1 ring-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
      type="button"
      aria-label={t("themeColor.spectrum")}
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

function colorToHsl(color: string) {
  const red = Number.parseInt(color.slice(1, 3), 16) / 255;
  const green = Number.parseInt(color.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(color.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (delta === 0) return { hue: 0, saturation: 0 };
  const hueBase =
    maximum === red
      ? (green - blue) / delta
      : maximum === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return {
    hue: (hueBase * 60 + 360) % 360,
    saturation: (delta / (1 - Math.abs(maximum + minimum - 1))) * 100,
  };
}

function colorMarkerPosition(color: string) {
  const { hue, saturation } = colorToHsl(color);
  const angle = ((hue - 90) * Math.PI) / 180;
  const radius = (saturation / 100) * 45;
  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`,
    backgroundColor: color,
  };
}
