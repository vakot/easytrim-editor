import { createContext, type Dispatch, useContext } from "react";

import type { AudioTrackProcessing } from "@/domain/audio-processing";

interface AudioTrackEffectsDraft {
  effectStatus: Record<string, { dirty: boolean; valid: boolean }>;
  initialProcessing: AudioTrackProcessing;
  processing: AudioTrackProcessing;
}

type AudioTrackEffectsDraftAction =
  | { type: "processingChanged"; value: AudioTrackProcessing }
  | { dirty: boolean; effectId: string; type: "effectStatusChanged"; valid: boolean };

interface AudioTrackEffectsDraftContextValue {
  dispatch: Dispatch<AudioTrackEffectsDraftAction>;
  draft: AudioTrackEffectsDraft;
}

const AudioTrackEffectsDraftContext = createContext<AudioTrackEffectsDraftContextValue | null>(
  null,
);

function useAudioTrackEffectsDraft() {
  const context = useContext(AudioTrackEffectsDraftContext);
  if (!context) {
    throw new Error("useAudioTrackEffectsDraft must be used within AudioTrackEffectsDraftProvider");
  }
  return context;
}

export { AudioTrackEffectsDraftContext, useAudioTrackEffectsDraft };
export type { AudioTrackEffectsDraft, AudioTrackEffectsDraftAction };
