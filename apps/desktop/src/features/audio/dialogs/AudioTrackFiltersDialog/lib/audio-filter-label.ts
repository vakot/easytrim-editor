import type { TFunction } from "i18next";

import type { AudioFilterType } from "@/domain/audio-processing";

/** The names of the filter types; the chain list shows them before any page is loaded. */
const AUDIO_FILTER_LABELS: { [T in AudioFilterType]: (t: TFunction) => string } = {
  highPass: (t) => t("audio.highPass.label"),
  noiseReduction: (t) => t("audio.noiseReduction.label"),
  limiter: (t) => t("audio.limiter.label"),
  loudnessNormalization: (t) => t("audio.normalization.label"),
  gain: (t) => t("audio.gain.label"),
};

function audioFilterLabel(type: AudioFilterType, t: TFunction): string {
  return AUDIO_FILTER_LABELS[type](t);
}

export { audioFilterLabel };
