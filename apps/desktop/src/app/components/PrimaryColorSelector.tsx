import { Check } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  primaryColorChanged,
  selectPrimaryColor,
  selectPrimaryColorKey,
} from "@/app/store/slices/theme-slice";
import {
  colorFromSpectrumPosition,
  CUSTOM_PRIMARY_COLOR,
  PRIMARY_COLORS,
  resolvePrimaryColor,
  type PrimaryColor,
} from "@/app/theme/theme";
import { useTheme } from "@/app/theme/use-theme";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const colorClasses: Record<Exclude<PrimaryColor, `#${string}`>, string> = {
  amber: "bg-[#efbf04]",
  rose: "bg-[#e85d75]",
  violet: "bg-[#8b6ee8]",
  blue: "bg-[#4299e1]",
  emerald: "bg-[#32a876]",
};

export function PrimaryColorSelector() {
  const { t } = useTranslation();
  const { previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();
  const primaryColor = useAppSelector(selectPrimaryColor);
  const primaryColorKey = useAppSelector(selectPrimaryColorKey);
  const [previewColor, setPreviewColor] = useState<PrimaryColor | null>(null);
  const selectedPrimaryColor = previewColor ?? primaryColor;
  const selectedColor = resolvePrimaryColor(selectedPrimaryColor);
  const selectedColorLabel =
    primaryColorKey === CUSTOM_PRIMARY_COLOR ? selectedColor : t(`themeColor.${primaryColorKey}`);

  const preview = (color: PrimaryColor) => {
    setPreviewColor(color);
    previewPrimaryColor(color);
  };
  const commit = (color: PrimaryColor) => {
    setPreviewColor(null);
    dispatch(primaryColorChanged(color));
  };
  const cancel = () => {
    setPreviewColor(null);
    previewPrimaryColor(null);
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label={t("themeColor.selection", {
                color: selectedColorLabel,
              })}
            >
              <span
                className="size-5 rounded-full ring-1 ring-foreground/15"
                aria-hidden="true"
                style={{ backgroundColor: selectedColor }}
              />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("themeColor.tooltip")}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-auto space-y-3 p-3" align="end">
        <SpectrumWheel
          color={selectedColor}
          onPreview={preview}
          onCommit={commit}
          onCancel={cancel}
        />
        <div className="flex gap-1" role="group" aria-label={t("themeColor.presets")}>
          {PRIMARY_COLORS.map((color) => {
            const selected = color === primaryColorKey;
            return (
              <button
                key={color}
                className={`flex size-9 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring ${colorClasses[color]} ${selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover" : ""}`}
                type="button"
                aria-label={t("themeColor.option", { color: t(`themeColor.${color}`) })}
                aria-pressed={selected}
                onClick={() => commit(color)}
              >
                {selected ? (
                  <Check className="size-4 text-white drop-shadow-sm" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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
