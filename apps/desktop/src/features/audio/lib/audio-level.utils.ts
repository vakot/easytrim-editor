import type { TFunction } from "i18next";

import type { AudioStream } from "@/lib/tauri/media.types";

export const MIN_SLIDER_DECIBELS = -24;
export const MAX_SLIDER_DECIBELS = 6;

function volumePercentToDecibels(volumePercent: number): number {
  if (volumePercent <= 0) return MIN_SLIDER_DECIBELS;
  const decibels = Math.max(
    MIN_SLIDER_DECIBELS,
    Math.min(MAX_SLIDER_DECIBELS, 20 * Math.log10(volumePercent / 50)),
  );

  return Math.round(decibels * 10) / 10;
}

function decibelsToVolumePercent(decibels: number): number {
  if (decibels <= MIN_SLIDER_DECIBELS) return 0;
  return 50 * 10 ** (decibels / 20);
}

function formatDecibels(volumePercent: number): string {
  if (volumePercent <= 0) return "−∞ dB";
  const decibels = 20 * Math.log10(volumePercent / 50);
  return `${decibels >= 0 ? "+" : ""}${decibels.toFixed(1)} dB`;
}

function formatChannels(stream: AudioStream, t: TFunction): string {
  if (stream.channelLayout) return stream.channelLayout;
  return stream.channels === undefined
    ? t("audio.options.unknownLayout")
    : t("audio.options.channels", { count: stream.channels });
}

function audioOutputSummary(enabledCount: number, mergeAudio: boolean, t: TFunction): string {
  if (enabledCount === 0) return t("audio.messages.output.videoOnly");
  if (mergeAudio && enabledCount > 1) {
    return t("audio.messages.output.merged", { count: enabledCount });
  }
  if (mergeAudio) return t("audio.messages.output.oneTrack");
  return t("audio.messages.output.separate", { count: enabledCount });
}

export {
  audioOutputSummary,
  decibelsToVolumePercent,
  formatChannels,
  formatDecibels,
  volumePercentToDecibels,
};
