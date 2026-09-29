import type { TFunction } from "i18next";

import type { AudioStream } from "@/lib/tauri/media.types";

const MIN_SLIDER_DECIBELS = -24;

function formatChannels(stream: AudioStream, t: TFunction): string {
  if (stream.channelLayout) return stream.channelLayout;
  return stream.channels === undefined
    ? t("audio.options.unknownLayout")
    : t("audio.options.channels", { count: stream.channels });
}

function formatGain(gainDb: number, language: string): string {
  if (gainDb <= MIN_SLIDER_DECIBELS) return "−∞ dB";

  const value = new Intl.NumberFormat(language, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(gainDb);

  return `${value.replace(/-/g, "−")} dB`;
}

function audioOutputSummary(enabledCount: number, mergeAudio: boolean, t: TFunction): string {
  if (enabledCount === 0) return t("audio.messages.output.videoOnly");
  if (mergeAudio && enabledCount > 1) {
    return t("audio.messages.output.merged", { count: enabledCount });
  }
  if (mergeAudio) return t("audio.messages.output.oneTrack");
  return t("audio.messages.output.separate", { count: enabledCount });
}

export { audioOutputSummary, formatChannels, formatGain, MIN_SLIDER_DECIBELS };
