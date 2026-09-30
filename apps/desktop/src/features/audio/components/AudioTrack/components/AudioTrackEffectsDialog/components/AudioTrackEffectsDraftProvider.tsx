import { type ReactNode, useReducer } from "react";

import {
  type AudioTrackProcessing,
  cloneAudioTrackProcessing,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
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
  const normalization = clonedProcessing.loudnessNormalization;
  const custom = typeof normalization === "object" ? normalization : null;

  return {
    maxTruePeakDbInput: String(
      custom?.maxTruePeakDb ?? DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.maxTruePeakDb,
    ),
    processing: clonedProcessing,
    targetLufsInput: String(custom?.targetLufs ?? DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION.targetLufs),
  };
}

function audioTrackEffectsDraftReducer(
  state: AudioTrackEffectsDraft,
  action: AudioTrackEffectsDraftAction,
): AudioTrackEffectsDraft {
  if (action.type === "normalizationSelected") {
    const currentNormalization = state.processing.loudnessNormalization;
    if (action.value === "custom") {
      const custom =
        typeof currentNormalization === "object"
          ? currentNormalization
          : DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION;

      return {
        ...state,
        maxTruePeakDbInput: String(custom.maxTruePeakDb),
        processing: {
          ...state.processing,
          loudnessNormalization: { ...custom },
        },
        targetLufsInput: String(custom.targetLufs),
      };
    }

    const processing = cloneAudioTrackProcessing(state.processing);
    if (action.value === "none") delete processing.loudnessNormalization;
    else processing.loudnessNormalization = action.value;
    return { ...state, processing };
  }

  const inputKey = action.field === "targetLufs" ? "targetLufsInput" : "maxTruePeakDbInput";
  const nextState = { ...state, [inputKey]: action.value };
  if (action.value.trim() === "") return nextState;

  const value = Number(action.value);
  if (!Number.isFinite(value)) return nextState;

  const currentNormalization = state.processing.loudnessNormalization;
  const custom =
    typeof currentNormalization === "object"
      ? currentNormalization
      : DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION;

  return {
    ...nextState,
    processing: {
      ...state.processing,
      loudnessNormalization: { ...custom, [action.field]: value },
    },
  };
}

export { AudioTrackEffectsDraftProvider };
