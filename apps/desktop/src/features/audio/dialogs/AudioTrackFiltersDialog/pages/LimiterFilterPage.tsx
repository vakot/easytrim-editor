import type { TFunction } from "i18next";

import type { AudioFilter } from "@/domain/audio-processing";

import { AudioFilterPageLayout } from "../components/AudioFilterPageLayout";
import { defineAudioFilterPageContent } from "../lib/audio-filter-fields";

const content = defineAudioFilterPageContent<"limiter">({
  description: (t: TFunction) => t("audio.limiter.description"),
  presetLabels: {
    peakProtection: (t) => t("audio.limiter.preset.peakProtection"),
    broadcastSafety: (t) => t("audio.limiter.preset.broadcastSafety"),
  },
  fields: [
    {
      parameter: "ceilingDb",
      label: (t) => t("audio.limiter.ceilingLabel"),
      unit: "dB",
      step: 0.1,
      slider: { min: -24, max: 0 },
    },
    {
      parameter: "attackMs",
      label: (t) => t("audio.limiter.attackLabel"),
      unit: "ms",
      step: 0.1,
      slider: { min: 0.1, max: 50 },
    },
    {
      parameter: "releaseMs",
      label: (t) => t("audio.limiter.releaseLabel"),
      unit: "ms",
      step: 1,
      slider: { min: 1, max: 1_000 },
    },
  ],
});

function LimiterFilterPage({ filter }: { filter: Extract<AudioFilter, { type: "limiter" }> }) {
  return <AudioFilterPageLayout content={content} filter={filter} />;
}

export { LimiterFilterPage };
