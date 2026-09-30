import {
  type AudioTrackProcessing,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  type LoudnessNormalization,
  loudnessNormalizationTargets,
  type LoudnessPreset,
} from "@/domain/audio-processing";

const NORMALIZATION_PRESETS = [
  "webVideo",
  "streaming",
  "broadcast",
] as const satisfies ReadonlyArray<LoudnessPreset>;

type NormalizationChoice = LoudnessPreset | "custom";

interface NormalizeLoudnessFormState {
  enabled: boolean;
  initialEnabled: boolean;
  initialNormalization: LoudnessNormalization;
  maxTruePeakDbInput: string;
  normalization: LoudnessNormalization;
  targetLufsInput: string;
}

type NormalizeLoudnessFormAction =
  | { type: "enabledChanged"; value: boolean }
  | { type: "presetChanged"; value: NormalizationChoice }
  | { type: "targetChanged"; value: string }
  | { type: "peakChanged"; value: string };

function createNormalizeLoudnessFormState(
  processing: AudioTrackProcessing,
): NormalizeLoudnessFormState {
  const initialEnabled = processing.loudnessNormalization !== undefined;
  const initialNormalization = processing.loudnessNormalization ?? "webVideo";
  const targets =
    typeof initialNormalization === "object"
      ? initialNormalization
      : loudnessNormalizationTargets(initialNormalization);

  return {
    initialEnabled,
    initialNormalization,
    enabled: initialEnabled,
    normalization: initialNormalization,
    targetLufsInput: String(targets.targetLufs),
    maxTruePeakDbInput: String(targets.maxTruePeakDb),
  };
}

function normalizeLoudnessFormReducer(
  state: NormalizeLoudnessFormState,
  action: NormalizeLoudnessFormAction,
): NormalizeLoudnessFormState {
  switch (action.type) {
    case "enabledChanged":
      return { ...state, enabled: action.value };
    case "presetChanged": {
      if (action.value === "custom") {
        const values =
          typeof state.normalization === "object"
            ? state.normalization
            : DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION;

        return {
          ...state,
          normalization: values,
          targetLufsInput: String(values.targetLufs),
          maxTruePeakDbInput: String(values.maxTruePeakDb),
        };
      }
      const values = loudnessNormalizationTargets(action.value);
      return {
        ...state,
        normalization: action.value,
        targetLufsInput: String(values.targetLufs),
        maxTruePeakDbInput: String(values.maxTruePeakDb),
      };
    }
    case "targetChanged":
      return {
        ...state,
        normalization: {
          mode: "custom",
          targetLufs: Number(action.value),
          maxTruePeakDb:
            typeof state.normalization === "object"
              ? state.normalization.maxTruePeakDb
              : loudnessNormalizationTargets(state.normalization).maxTruePeakDb,
        },
        targetLufsInput: action.value,
      };
    case "peakChanged":
      return {
        ...state,
        normalization: {
          mode: "custom",
          targetLufs:
            typeof state.normalization === "object"
              ? state.normalization.targetLufs
              : loudnessNormalizationTargets(state.normalization).targetLufs,
          maxTruePeakDb: Number(action.value),
        },
        maxTruePeakDbInput: action.value,
      };
  }
}

function isNormalizeLoudnessFormValid(state: NormalizeLoudnessFormState): boolean {
  const target = Number(state.targetLufsInput);
  const peak = Number(state.maxTruePeakDbInput);
  return (
    Number.isFinite(target) &&
    target >= -36 &&
    target <= -5 &&
    Number.isFinite(peak) &&
    peak >= -9 &&
    peak <= 0
  );
}

function isNormalizeLoudnessEffectValid(state: NormalizeLoudnessFormState): boolean {
  return !state.enabled || isNormalizeLoudnessFormValid(state);
}

function isNormalizeLoudnessFormDirty(state: NormalizeLoudnessFormState): boolean {
  return (
    state.enabled !== state.initialEnabled ||
    !sameNormalizationChoice(state.initialNormalization, state.normalization)
  );
}

function getDraftLoudnessNormalization(
  state: NormalizeLoudnessFormState,
  currentNormalization: LoudnessNormalization | undefined,
  initialNormalization: LoudnessNormalization | undefined,
): LoudnessNormalization | undefined {
  if (!state.enabled) return undefined;

  if (typeof state.normalization !== "object") return state.normalization;
  if (isNormalizeLoudnessFormValid(state)) {
    return {
      mode: "custom",
      targetLufs: Number(state.targetLufsInput),
      maxTruePeakDb: Number(state.maxTruePeakDbInput),
    };
  }

  if (typeof currentNormalization === "object") return currentNormalization;
  if (typeof initialNormalization === "object") return initialNormalization;
  if (typeof state.initialNormalization === "object") return state.initialNormalization;
  return DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION;
}

function sameNormalizationChoice(
  left: LoudnessNormalization,
  right: LoudnessNormalization,
): boolean {
  if (left === right) return true;
  return (
    typeof left === "object" &&
    typeof right === "object" &&
    left.targetLufs === right.targetLufs &&
    left.maxTruePeakDb === right.maxTruePeakDb
  );
}

export {
  createNormalizeLoudnessFormState,
  getDraftLoudnessNormalization,
  isNormalizeLoudnessEffectValid,
  isNormalizeLoudnessFormDirty,
  isNormalizeLoudnessFormValid,
  NORMALIZATION_PRESETS,
  normalizeLoudnessFormReducer,
  sameNormalizationChoice,
};
export type { NormalizationChoice, NormalizeLoudnessFormAction, NormalizeLoudnessFormState };
