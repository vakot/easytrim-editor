import type { TFunction } from "i18next";

import type { AudioFilter } from "@/domain/audio-processing";

import { AudioFilterPageLayout } from "../components/AudioFilterPageLayout";
import { defineAudioFilterPageContent } from "../lib/audio-filter-fields";

const content = defineAudioFilterPageContent<"noiseReduction">({
  description: (t: TFunction) => t("audio.noiseReduction.description"),
  presetLabels: {
    light: (t) => t("audio.noiseReduction.strength.light"),
    medium: (t) => t("audio.noiseReduction.strength.medium"),
    strong: (t) => t("audio.noiseReduction.strength.strong"),
  },
  fields: [
    {
      parameter: "reductionDb",
      label: (t) => t("audio.noiseReduction.reductionLabel"),
      unit: "dB",
      step: 0.5,
      slider: { min: 1, max: 40 },
    },
    {
      parameter: "noiseFloorDb",
      label: (t) => t("audio.noiseReduction.noiseFloorLabel"),
      unit: "dB",
      step: 1,
      slider: { min: -80, max: -20 },
    },
  ],
});

function NoiseReductionFilterPage({
  filter,
}: {
  filter: Extract<AudioFilter, { type: "noiseReduction" }>;
}) {
  return <AudioFilterPageLayout content={content} filter={filter} />;
}

export { NoiseReductionFilterPage };
