import type { TFunction } from "i18next";
import type { ComponentType } from "react";

import {
  type AudioProcessingStage,
  type AudioTrackProcessing,
  getAudioTrackSignalEffect,
  sameLoudnessNormalization,
} from "@/domain/audio-processing";

import { NoiseReductionPage } from "../pages/NoiseReductionPage";
import { NormalizeLoudnessPage } from "../pages/NormalizeLoudnessPage";

interface AudioTrackEffectsPageProps {
  streamIndex: number;
}

interface AudioTrackEffectDescriptor {
  id: string;
  isDirty: (initial: AudioTrackProcessing, current: AudioTrackProcessing) => boolean;
  isEnabled: (processing: AudioTrackProcessing) => boolean;
  label: (t: TFunction) => string;
  Page: ComponentType<AudioTrackEffectsPageProps>;
  stage: AudioProcessingStage;
}

const AUDIO_TRACK_EFFECTS: readonly AudioTrackEffectDescriptor[] = [
  {
    id: "noiseReduction",
    stage: "cleanup",
    label: (t) => t("audio.labels.noiseReduction"),
    Page: NoiseReductionPage,
    isEnabled: (processing) =>
      getAudioTrackSignalEffect(processing, "noiseReduction") !== undefined,
    isDirty: (initial, current) =>
      getAudioTrackSignalEffect(initial, "noiseReduction")?.preset !==
      getAudioTrackSignalEffect(current, "noiseReduction")?.preset,
  },
  {
    id: "loudnessNormalization",
    stage: "levelPolicy",
    label: (t) => t("audio.labels.loudnessNormalization"),
    Page: NormalizeLoudnessPage,
    isEnabled: (processing) => processing.loudnessNormalization !== undefined,
    isDirty: (initial, current) =>
      !sameLoudnessNormalization(initial.loudnessNormalization, current.loudnessNormalization),
  },
];

export { AUDIO_TRACK_EFFECTS };
export type { AudioTrackEffectDescriptor };
