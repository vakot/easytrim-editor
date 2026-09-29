import { type ReactNode, useReducer } from "react";

import {
  type AudioTrackProcessing,
  cloneAudioTrackProcessing,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  loudnessNormalizationTargets,
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
  const normalization = clonedProcessing.loudnessNormalization ?? "webVideo";
  clonedProcessing.loudnessNormalization = normalization;
  const targets = loudnessNormalizationTargets(normalization);

  return {
    maxTruePeakDbInput: String(targets.maxTruePeakDb),
    normalizationEnabled,
    processing: clonedProcessing,
    targetLufsInput: String(targets.targetLufs),
  };
}

function audioTrackEffectsDraftReducer(
  state: AudioTrackEffectsDraft,
  action: AudioTrackEffectsDraftAction,
): AudioTrackEffectsDraft {
  if (action.type === "normalizationEnabledChanged") {
    return { ...state, normalizationEnabled: action.value };
  }

  if (action.type === "normalizationSelected") {
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
      processing: { ...state.processing, loudnessNormalization: normalization },
      targetLufsInput: String(targets.targetLufs),
    };
  }

  const inputKey = action.field === "targetLufs" ? "targetLufsInput" : "maxTruePeakDbInput";
  const nextState = { ...state, [inputKey]: action.value };
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

export { AudioTrackEffectsDraftProvider };
