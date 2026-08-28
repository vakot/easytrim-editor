import type { TFunction } from "i18next";

import type { AudioStream } from "@/lib/tauri/media";

export const MIN_SLIDER_DECIBELS = -24;
export const MAX_SLIDER_DECIBELS = 6;

export function volumePercentToDecibels(volumePercent: number): number {
  if (volumePercent <= 0) return MIN_SLIDER_DECIBELS;
  const decibels = Math.max(
    MIN_SLIDER_DECIBELS,
    Math.min(MAX_SLIDER_DECIBELS, 20 * Math.log10(volumePercent / 50)),
  );
  return Math.round(decibels * 10) / 10;
}

export function decibelsToVolumePercent(decibels: number): number {
  if (decibels <= MIN_SLIDER_DECIBELS) return 0;
  return 50 * 10 ** (decibels / 20);
}

export function formatDecibels(volumePercent: number): string {
  if (volumePercent <= 0) return "−∞ dB";
  const decibels = 20 * Math.log10(volumePercent / 50);
  return `${decibels >= 0 ? "+" : ""}${decibels.toFixed(1)} dB`;
}

export function formatChannels(stream: AudioStream, t: TFunction): string {
  if (stream.channelLayout) return stream.channelLayout;
  return stream.channels === undefined
    ? t("audio.unknownLayout")
    : t("audio.channels", { count: stream.channels });
}

export function audioOutputSummary(
  enabledCount: number,
  mergeAudio: boolean,
  t: TFunction,
): string {
  if (enabledCount === 0) return t("audio.output.videoOnly");
  if (mergeAudio && enabledCount > 1) {
    return t("audio.output.merged", { count: enabledCount });
  }
  if (mergeAudio) return t("audio.output.oneTrack");
  return t("audio.output.separate", { count: enabledCount });
}
