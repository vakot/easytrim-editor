import type { TFunction } from "i18next";

import type { AudioFilterParameters, AudioFilterType } from "@/domain/audio-processing";

interface AudioFilterField<T extends AudioFilterType> {
  label: (t: TFunction) => string;
  parameter: keyof AudioFilterParameters<T> & string;
  /** A practical slider span inside the valid range; the input accepts the whole range. */
  slider: { max: number; min: number };
  step: number;
  /** Technical units stay untranslated. */
  unit: string;
}

interface AudioFilterDescriptor<T extends AudioFilterType> {
  description: (t: TFunction) => string;
  fields: readonly AudioFilterField<T>[];
  label: (t: TFunction) => string;
  presetLabels: Readonly<Record<string, (t: TFunction) => string>>;
}

const AUDIO_FILTER_DESCRIPTORS: { [T in AudioFilterType]: AudioFilterDescriptor<T> } = {
  highPass: {
    label: (t) => t("audio.highPass.label"),
    description: (t) => t("audio.highPass.description"),
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
        slider: { min: 20, max: 300 },
      },
    ],
  },
  noiseReduction: {
    label: (t) => t("audio.noiseReduction.label"),
    description: (t) => t("audio.noiseReduction.description"),
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
  },
  limiter: {
    label: (t) => t("audio.limiter.label"),
    description: (t) => t("audio.limiter.description"),
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
  },
  loudnessNormalization: {
    label: (t) => t("audio.normalization.label"),
    description: (t) => t("audio.normalization.description"),
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
  },
  gain: {
    label: (t) => t("audio.gain.label"),
    description: (t) => t("audio.gain.description"),
    presetLabels: {},
    fields: [
      {
        parameter: "gainDb",
        label: (t) => t("audio.gain.gainLabel"),
        unit: "dB",
        step: 0.5,
        slider: { min: -24, max: 24 },
      },
    ],
  },
};

function audioFilterDescriptor<T extends AudioFilterType>(type: T): AudioFilterDescriptor<T> {
  return AUDIO_FILTER_DESCRIPTORS[type] as AudioFilterDescriptor<T>;
}

export type { AudioFilterField };
export { audioFilterDescriptor };
