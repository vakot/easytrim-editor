import type { TFunction } from "i18next";

import type { AudioFilter } from "@/domain/audio-processing";

import { AudioFilterPageLayout } from "../components/AudioFilterPageLayout";
import { defineAudioFilterPageContent } from "../lib/audio-filter-fields";

const content = defineAudioFilterPageContent<"highPass">({
  description: (t: TFunction) => t("audio.highPass.description"),
  presetLabels: {
    rumble: (t) => t("audio.highPass.preset.rumble"),
    voice: (t) => t("audio.highPass.preset.voice"),
    dialogue: (t) => t("audio.highPass.preset.dialogue"),
    wind: (t) => t("audio.highPass.preset.wind"),
  },
  fields: [
    {
      parameter: "cutoffHz",
      label: (t) => t("audio.highPass.cutoffLabel"),
      unit: "Hz",
      step: 1,
    },
  ],
});

function HighPassFilterPage({ filter }: { filter: Extract<AudioFilter, { type: "highPass" }> }) {
  return <AudioFilterPageLayout content={content} filter={filter} />;
}

export { HighPassFilterPage };
