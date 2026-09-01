import type { TFunction } from "i18next";

import type { FrameRate } from "@/lib/tauri/media.types";

export const FRAME_RATE_OPTIONS = [24, 25, 30, 50, 60, 120] as const;

interface ResolutionDimensions {
  height: number;
  width: number;
}

export function resolutionOptions(dimensions: ResolutionDimensions, t: TFunction) {
  const options: { label: string; value: string }[] = [
    {
      label: t("export.options.sourceResolution", {
        width: dimensions.width,
        height: dimensions.height,
      }),
      value: `${dimensions.width}x${dimensions.height}`,
    },
  ];

  for (const height of [2160, 1440, 1080]) {
    if (height < dimensions.height) {
      const width = Math.round((dimensions.width * height) / dimensions.height / 2) * 2;
      options.push({
        label: `${height}p \u00b7 ${width} \u00d7 ${height}`,
        value: `${width}x${height}`,
      });
    }
  }
  return options;
}

export function rateFromValue(value: string): FrameRate | undefined {
  if (value === "source") return undefined;
  const [numerator, denominator] = value.split("/").map(Number);
  return numerator && denominator ? { numerator, denominator } : undefined;
}
