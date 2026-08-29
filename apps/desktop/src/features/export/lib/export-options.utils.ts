import type { TFunction } from "i18next";

import type { FrameRate, MediaInfo } from "@/lib/tauri/media.types";

export const FRAME_RATE_OPTIONS = [24, 25, 30, 50, 60, 120] as const;

export function resolutionOptions(source: MediaInfo, t: TFunction) {
  const options: { label: string; value: string }[] = [
    {
      label: t("export.sourceResolution", {
        width: source.video.width,
        height: source.video.height,
      }),
      value: `${source.video.width}x${source.video.height}`,
    },
  ];

  for (const height of [2160, 1440, 1080]) {
    if (height < source.video.height) {
      const width = Math.round((source.video.width * height) / source.video.height / 2) * 2;
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
