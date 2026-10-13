import { cloneAudioTrackProcessing, sameAudioTrackProcessing } from "@/domain/audio-processing";

import type {
  AudioTrackEffectsDraft,
  AudioTrackEffectsDraftAction,
} from "../contexts/audio-track-effects-draft-context";

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

export { audioTrackEffectsDraftReducer };
