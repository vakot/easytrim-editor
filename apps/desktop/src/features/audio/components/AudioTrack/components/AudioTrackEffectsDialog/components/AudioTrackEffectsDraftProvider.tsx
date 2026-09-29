import { type ReactNode, useReducer } from "react";

import {
  type AudioTrackProcessing,
  cloneAudioTrackProcessing,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  loudnessNormalizationTargets,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";

import {
  type AudioTrackEffectsDraft,
  type AudioTrackEffectsDraftAction,
  AudioTrackEffectsDraftContext,
} from "../contexts/audio-track-effects-draft-context";

function AudioTrackEffectsDraftProvider({
  children,
  initialProcessing,
}: {
  children: ReactNode;
  initialProcessing: AudioTrackProcessing;
}) {
  const [draft, dispatch] = useReducer(
    audioTrackEffectsDraftReducer,
    initialProcessing,
    createAudioTrackEffectsDraft,
  );

  return (
    <AudioTrackEffectsDraftContext.Provider value={{ dispatch, draft }}>
      {children}
    </AudioTrackEffectsDraftContext.Provider>
  );
}

function createAudioTrackEffectsDraft(processing: AudioTrackProcessing): AudioTrackEffectsDraft {
  const clonedProcessing = cloneAudioTrackProcessing(processing);
  const normalizationEnabled = clonedProcessing.loudnessNormalization !== undefined;
  const normalization = clonedProcessing.loudnessNormalization;
  const normalizationPreset =
    normalization === undefined
      ? "default"
      : typeof normalization === "object"
        ? "custom"
        : normalization;

  const targets =
    typeof normalization === "string" ? loudnessNormalizationTargets(normalization) : normalization;

  return {
    maxTruePeakDbInput: targets === undefined ? "" : String(targets.maxTruePeakDb),
    normalizationPreset,
    normalizationEnabled,
    processing: clonedProcessing,
    targetLufsInput: targets === undefined ? "" : String(targets.targetLufs),
  };
}

function audioTrackEffectsDraftReducer(
  state: AudioTrackEffectsDraft,
  action: AudioTrackEffectsDraftAction,
): AudioTrackEffectsDraft {
  if (action.type === "normalizationEnabledChanged") {
    return { ...state, normalizationEnabled: action.value };
  }

  if (action.type === "analysisValuesReceived") {
    if (state.normalizationPreset !== "default") return state;

    const targetLufsInput =
      state.targetLufsInput.trim() === "" && action.value.integratedLufs !== undefined
        ? String(action.value.integratedLufs)
        : state.targetLufsInput;

    const maxTruePeakDbInput =
      state.maxTruePeakDbInput.trim() === "" && action.value.truePeakDb !== undefined
        ? String(action.value.truePeakDb)
        : state.maxTruePeakDbInput;

    const targetLufs = parseInput(targetLufsInput);
    const maxTruePeakDb = parseInput(maxTruePeakDbInput);
    const processing = cloneAudioTrackProcessing(state.processing);

    if (targetLufs !== undefined && maxTruePeakDb !== undefined) {
      processing.loudnessNormalization = { maxTruePeakDb, mode: "custom", targetLufs };
    } else {
      delete processing.loudnessNormalization;
    }

    if (
      targetLufsInput === state.targetLufsInput &&
      maxTruePeakDbInput === state.maxTruePeakDbInput &&
      sameAudioTrackProcessing(processing, state.processing)
    ) {
      return state;
    }

    return { ...state, maxTruePeakDbInput, processing, targetLufsInput };
  }

  if (action.type === "normalizationSelected") {
    if (action.value === "default") {
      const processing = cloneAudioTrackProcessing(state.processing);
      delete processing.loudnessNormalization;
      return {
        ...state,
        maxTruePeakDbInput: "",
        normalizationPreset: "default",
        processing,
        targetLufsInput: "",
      };
    }

    const normalization =
      action.value === "custom"
        ? typeof state.processing.loudnessNormalization === "object"
          ? state.processing.loudnessNormalization
          : DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION
        : action.value;

    const targets = loudnessNormalizationTargets(normalization);

    return {
      ...state,
      maxTruePeakDbInput: String(targets.maxTruePeakDb),
      normalizationPreset: action.value,
      processing: { ...state.processing, loudnessNormalization: normalization },
      targetLufsInput: String(targets.targetLufs),
    };
  }

  const inputKey = action.field === "targetLufs" ? "targetLufsInput" : "maxTruePeakDbInput";
  const nextState = { ...state, normalizationPreset: "custom" as const, [inputKey]: action.value };
  const value = Number(action.value);

  const currentNormalization = state.processing.loudnessNormalization;
  const custom =
    typeof currentNormalization === "object"
      ? currentNormalization
      : {
          mode: "custom" as const,
          ...loudnessNormalizationTargets(currentNormalization ?? "webVideo"),
        };

  const customValue =
    action.value.trim() === "" || !Number.isFinite(value) ? custom[action.field] : value;

  return {
    ...nextState,
    processing: {
      ...state.processing,
      loudnessNormalization: { ...custom, [action.field]: customValue },
    },
  };
}

function parseInput(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export { AudioTrackEffectsDraftProvider };
