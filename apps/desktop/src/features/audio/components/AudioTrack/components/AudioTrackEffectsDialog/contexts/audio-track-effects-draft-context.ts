import { createContext, type Dispatch, useContext } from "react";

import type { AudioTrackProcessing } from "@/domain/audio-processing";

type NormalizationOption = "webVideo" | "streaming" | "broadcast" | "custom";

interface AudioTrackEffectsDraft {
  maxTruePeakDbInput: string;
  normalizationEnabled: boolean;
  processing: AudioTrackProcessing;
  targetLufsInput: string;
}

type AudioTrackEffectsDraftAction =
  | {
      field: "targetLufs" | "maxTruePeakDb";
      type: "customValueChanged";
      value: string;
    }
  | { type: "normalizationEnabledChanged"; value: boolean }
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
