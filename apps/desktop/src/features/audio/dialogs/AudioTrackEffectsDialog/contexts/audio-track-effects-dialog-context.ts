import { createContext, useContext } from "react";

import type { AudioTrackEffectId } from "../../../components/AudioTrack/components/AudioTrackEffectsLibrary/consts/audio-track-effects";

const AudioTrackEffectsDialogContext = createContext<{
  openEffects: (initialView?: AudioTrackEffectId) => void;
  preloadEffects: () => void;
} | null>(null);

function useAudioTrackEffectsDialog() {
  const context = useContext(AudioTrackEffectsDialogContext);
  if (!context) {
    throw new Error("useAudioTrackEffectsDialog must be used within AudioTrackEffectsDialog");
  }
  return context;
}

export { AudioTrackEffectsDialogContext, useAudioTrackEffectsDialog };
