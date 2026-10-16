import type { TFunction } from "i18next";

import type { AudioFilter } from "@/domain/audio-processing";

import { AudioFilterPageLayout } from "../components/AudioFilterPageLayout";
import { defineAudioFilterPageContent } from "../lib/audio-filter-fields";

const content = defineAudioFilterPageContent<"loudnessNormalization">({
  description: (t: TFunction) => t("audio.normalization.description"),
  presetLabels: {
    webVideo: (t) => t("audio.normalization.preset.webVideo"),
    streaming: (t) => t("audio.normalization.preset.streaming"),
    broadcast: (t) => t("audio.normalization.preset.broadcast"),
  },
  fields: [
    {
      parameter: "targetLufs",
      label: (t) => t("audio.normalization.targetLabel"),
      unit: "LUFS",
      step: 0.5,
      slider: { min: -36, max: -5 },
    },
    {
      parameter: "maxTruePeakDb",
      label: (t) => t("audio.normalization.truePeakLabel"),
      unit: "dBTP",
      step: 0.1,
      slider: { min: -9, max: 0 },
    },
    {
      parameter: "loudnessRangeLu",
      label: (t) => t("audio.normalization.loudnessRangeLabel"),
      unit: "LU",
      step: 0.5,
      slider: { min: 1, max: 20 },
    },
  ],
});

function LoudnessNormalizationFilterPage({
  filter,
}: {
  filter: Extract<AudioFilter, { type: "loudnessNormalization" }>;
}) {
  return <AudioFilterPageLayout content={content} filter={filter} />;
}

export { LoudnessNormalizationFilterPage };
