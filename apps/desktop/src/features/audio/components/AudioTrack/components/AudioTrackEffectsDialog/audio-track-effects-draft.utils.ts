import { type AudioTrackProcessing, cloneAudioTrackProcessing } from "@/domain/audio-processing";

import type { AudioTrackEffectDescriptor } from "../AudioTrackEffectsLibrary/consts/audio-track-effects";

import type { AudioTrackEffectsDraft } from "./contexts/audio-track-effects-draft-context";

function getAudioTrackEffectsDraftProcessing(draft: AudioTrackEffectsDraft): AudioTrackProcessing {
  return cloneAudioTrackProcessing(draft.processing);
}

function isAudioTrackEffectsDraftDirty(
  draft: AudioTrackEffectsDraft,
  effects: readonly AudioTrackEffectDescriptor[],
): boolean {
  return effects.some(
    (effect) =>
      effect.isDirty(draft.initialProcessing, draft.processing) ||
      (draft.effectStatus[effect.id]?.dirty ?? false),
  );
}

function isAudioTrackEffectsDraftValid(
  draft: AudioTrackEffectsDraft,
  effects: readonly AudioTrackEffectDescriptor[],
): boolean {
  return effects.every((effect) => draft.effectStatus[effect.id]?.valid ?? true);
}

export {
  getAudioTrackEffectsDraftProcessing,
  isAudioTrackEffectsDraftDirty,
  isAudioTrackEffectsDraftValid,
};
