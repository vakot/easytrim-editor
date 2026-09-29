import { type AudioTrackProcessing, cloneAudioTrackProcessing } from "@/domain/audio-processing";

import type { AudioTrackEffectsDraft } from "./contexts/audio-track-effects-draft-context";

function getAudioTrackEffectsDraftProcessing(draft: AudioTrackEffectsDraft): AudioTrackProcessing {
  const processing = cloneAudioTrackProcessing(draft.processing);
  if (!draft.normalizationEnabled) delete processing.loudnessNormalization;
  return processing;
}

function isAudioTrackEffectsDraftValid(draft: AudioTrackEffectsDraft): boolean {
  if (!draft.normalizationEnabled || typeof draft.processing.loudnessNormalization !== "object") {
    return true;
  }

  return isInRange(draft.targetLufsInput, -36, -5) && isInRange(draft.maxTruePeakDbInput, -9, 0);
}

function isInRange(value: string, min: number, max: number): boolean {
  if (value.trim() === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

export { getAudioTrackEffectsDraftProcessing, isAudioTrackEffectsDraftValid };
