import type { TFunction } from "i18next";
import type { ComponentType } from "react";

import {
  type AudioProcessingStage,
  type AudioTrackProcessing,
  getAudioTrackSignalEffect,
  sameLoudnessNormalization,
} from "@/domain/audio-processing";

import { LimiterPage } from "../pages/LimiterPage";
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
  {
    id: "limiter",
    stage: "finalProtection",
    label: (t) => t("audio.labels.limiter"),
    Page: LimiterPage,
    isEnabled: (processing) => getAudioTrackSignalEffect(processing, "limiter") !== undefined,
    isDirty: (initial, current) => {
      const initialLimiter = getAudioTrackSignalEffect(initial, "limiter");
      const currentLimiter = getAudioTrackSignalEffect(current, "limiter");
      return (
        initialLimiter?.ceilingDb !== currentLimiter?.ceilingDb ||
        (initialLimiter === undefined) !== (currentLimiter === undefined)
      );
    },
  },
];

export { AUDIO_TRACK_EFFECTS };
export type { AudioTrackEffectDescriptor };
