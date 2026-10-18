import type { TFunction } from "i18next";

import type { AudioFilter } from "@/domain/audio-processing";

import { AudioFilterPageLayout } from "../components/AudioFilterPageLayout";
import { defineAudioFilterPageContent } from "../lib/audio-filter-fields";

const content = defineAudioFilterPageContent<"gain">({
  description: (t: TFunction) => t("audio.gain.description"),
  presetLabels: {},
  fields: [
    {
      parameter: "gainDb",
      label: (t) => t("audio.gain.gainLabel"),
      unit: "dB",
      defaultValue: 0,
      step: 0.5,
    },
  ],
});

function GainFilterPage({ filter }: { filter: Extract<AudioFilter, { type: "gain" }> }) {
  return <AudioFilterPageLayout content={content} filter={filter} />;
}

export { GainFilterPage };
