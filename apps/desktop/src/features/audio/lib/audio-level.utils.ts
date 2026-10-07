import type { TFunction } from "i18next";

import type { LoudnessPreset, NoiseReductionPreset } from "@/domain/audio-processing";
import type { AudioStream } from "@/lib/tauri/media.types";

const MIN_SLIDER_DECIBELS = -24;
function normalizationPresetLabel(preset: LoudnessPreset, t: TFunction): string {
  switch (preset) {
    case "broadcast":
      return t("audio.normalization.preset.broadcast");
    case "streaming":
      return t("audio.normalization.preset.streaming");
    case "webVideo":
      return t("audio.normalization.preset.webVideo");
  }
}

function noiseReductionPresetLabel(preset: NoiseReductionPreset, t: TFunction): string {
  switch (preset) {
    case "light":
      return t("audio.noiseReduction.strength.light");
    case "medium":
      return t("audio.noiseReduction.strength.medium");
    case "strong":
      return t("audio.noiseReduction.strength.strong");
  }
}

function formatChannels(stream: AudioStream, t: TFunction): string {
  if (stream.channelLayout) return stream.channelLayout;
  return stream.channels === undefined
    ? t("audio.tracks.unknownLayout")
    : t("audio.tracks.channels", { count: stream.channels });
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
  if (enabledCount === 0) return t("audio.output.videoOnly");
  if (mergeAudio && enabledCount > 1) {
    return t("audio.output.merged", { count: enabledCount });
  }
  if (mergeAudio) return t("audio.output.oneTrack");
  return t("audio.output.separate", { count: enabledCount });
}

export {
  audioOutputSummary,
  formatChannels,
  formatGain,
  MIN_SLIDER_DECIBELS,
  noiseReductionPresetLabel,
  normalizationPresetLabel,
};
