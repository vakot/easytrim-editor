import { createContext, type Dispatch, useContext } from "react";

import type { AudioTrackProcessing, CustomLoudnessNormalization } from "@/domain/audio-processing";

type NormalizationOption = "none" | "webVideo" | "streaming" | "broadcast" | "custom";

interface AudioTrackEffectsDraft {
  maxTruePeakDbInput: string;
  processing: AudioTrackProcessing;
  targetLufsInput: string;
}

type AudioTrackEffectsDraftAction =
  | { field: keyof CustomLoudnessNormalization; type: "customValueChanged"; value: string }
  | { type: "normalizationSelected"; value: NormalizationOption };

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
export type { AudioTrackEffectsDraft, AudioTrackEffectsDraftAction, NormalizationOption };
