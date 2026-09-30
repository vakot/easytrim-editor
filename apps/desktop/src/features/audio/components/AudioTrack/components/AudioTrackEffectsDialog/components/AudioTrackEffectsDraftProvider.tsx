import { type ReactNode, useReducer } from "react";

import {
  type AudioTrackProcessing,
  cloneAudioTrackProcessing,
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
    (value) => {
      const processing = cloneAudioTrackProcessing(value);
      return {
        effectStatus: {},
        initialProcessing: cloneAudioTrackProcessing(processing),
        processing,
      };
    },
  );

  return (
    <AudioTrackEffectsDraftContext.Provider value={{ dispatch, draft }}>
      {children}
    </AudioTrackEffectsDraftContext.Provider>
  );
}

function audioTrackEffectsDraftReducer(
  state: AudioTrackEffectsDraft,
  action: AudioTrackEffectsDraftAction,
): AudioTrackEffectsDraft {
  if (action.type === "processingChanged") {
    if (sameAudioTrackProcessing(state.processing, action.value)) return state;
    return { ...state, processing: cloneAudioTrackProcessing(action.value) };
  }

  const current = state.effectStatus[action.effectId];
  if (current?.dirty === action.dirty && current.valid === action.valid) return state;
  return {
    ...state,
    effectStatus: {
      ...state.effectStatus,
      [action.effectId]: { dirty: action.dirty, valid: action.valid },
    },
  };
}

export { AudioTrackEffectsDraftProvider };
