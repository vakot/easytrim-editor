import type { TFunction } from "i18next";
import type { ComponentType } from "react";

import {
  type AudioProcessingStage,
  type AudioTrackProcessing,
  getAudioTrackSignalEffect,
  sameLoudnessNormalization,
} from "@/domain/audio-processing";
import { lazyWithPreload } from "@/lib/lazy-component";

interface AudioTrackEffectsPageProps {
  streamIndex: number;
}

const LazyHighPassPage = lazyWithPreload<AudioTrackEffectsPageProps>(() =>
  import("../pages/HighPassPage").then((module) => ({ default: module.HighPassPage })),
);

const LazyNoiseReductionPage = lazyWithPreload<AudioTrackEffectsPageProps>(() =>
  import("../pages/NoiseReductionPage").then((module) => ({ default: module.NoiseReductionPage })),
);

const LazyNormalizeLoudnessPage = lazyWithPreload<AudioTrackEffectsPageProps>(() =>
  import("../pages/NormalizeLoudnessPage").then((module) => ({
    default: module.NormalizeLoudnessPage,
  })),
);

const LazyLimiterPage = lazyWithPreload<AudioTrackEffectsPageProps>(() =>
  import("../pages/LimiterPage").then((module) => ({ default: module.LimiterPage })),
);

interface AudioTrackEffectDescriptor {
  defaultSelected?: boolean;
  id: string;
  isDirty: (initial: AudioTrackProcessing, current: AudioTrackProcessing) => boolean;
  isEnabled: (processing: AudioTrackProcessing) => boolean;
  label: (t: TFunction) => string;
  Page: ComponentType<AudioTrackEffectsPageProps>;
  preload: () => Promise<unknown>;
  stage: AudioProcessingStage;
}

const AUDIO_TRACK_EFFECTS = [
  {
    defaultSelected: true,
    id: "highPass",
    stage: "cleanup",
    label: (t) => t("audio.highPass.label"),
    Page: LazyHighPassPage,
    preload: () => LazyHighPassPage.preload(),
    isEnabled: (processing) =>
      getAudioTrackSignalEffect(processing, "highPass", "cleanup") !== undefined,
    isDirty: (initial, current) =>
      getAudioTrackSignalEffect(initial, "highPass", "cleanup")?.cutoffHz !==
      getAudioTrackSignalEffect(current, "highPass", "cleanup")?.cutoffHz,
  },
  {
    id: "noiseReduction",
    stage: "cleanup",
    label: (t) => t("audio.noiseReduction.label"),
    Page: LazyNoiseReductionPage,
    preload: () => LazyNoiseReductionPage.preload(),
    isEnabled: (processing) =>
      getAudioTrackSignalEffect(processing, "noiseReduction") !== undefined,
    isDirty: (initial, current) =>
      getAudioTrackSignalEffect(initial, "noiseReduction")?.preset !==
      getAudioTrackSignalEffect(current, "noiseReduction")?.preset,
  },
  {
    id: "loudnessNormalization",
    stage: "levelPolicy",
    label: (t) => t("audio.normalization.label"),
    Page: LazyNormalizeLoudnessPage,
    preload: () => LazyNormalizeLoudnessPage.preload(),
    isEnabled: (processing) => processing.loudnessNormalization !== undefined,
    isDirty: (initial, current) =>
      !sameLoudnessNormalization(initial.loudnessNormalization, current.loudnessNormalization),
  },
  {
    id: "limiter",
    stage: "finalProtection",
    label: (t) => t("audio.limiter.label"),
    Page: LazyLimiterPage,
    preload: () => LazyLimiterPage.preload(),
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
] as const satisfies readonly AudioTrackEffectDescriptor[];

export { AUDIO_TRACK_EFFECTS };
export type { AudioTrackEffectDescriptor };
export type AudioTrackEffectId = (typeof AUDIO_TRACK_EFFECTS)[number]["id"];
