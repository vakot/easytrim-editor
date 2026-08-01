import type { FrameRate, MediaInfo } from "@/lib/tauri/media";
import type { TFunction } from "i18next";

export const DEFAULT_ARGUMENTS =
  "-c:v hevc_nvenc -preset p5 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k";

export const FRAME_RATE_OPTIONS = [24, 25, 30, 50, 60, 120] as const;

export function outputDefaults(sourceName: string) {
  const stem = sourceName.replace(/\.[^/.]+$/, "") || "clip";
  return { fast: `${stem}-cut.mkv`, optimized: `${stem}-optimized.mp4` };
}

export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !==
      null
  );
}

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
      options.push({ label: `${height}p · ${width} × ${height}`, value: `${width}x${height}` });
    }
  }
  return options;
}

export function rateFromValue(value: string): FrameRate | undefined {
  if (value === "source") return undefined;
  const [numerator, denominator] = value.split("/").map(Number);
  return numerator && denominator ? { numerator, denominator } : undefined;
}
