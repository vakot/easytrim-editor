import { createContext, useContext } from "react";

const AudioTrackEffectsDialogContext = createContext<{ openEffects: () => void } | null>(null);

function useAudioTrackEffectsDialog() {
  const context = useContext(AudioTrackEffectsDialogContext);
  if (!context) {
    throw new Error("useAudioTrackEffectsDialog must be used within AudioTrackEffectsDialog");
  }
  return context;
}

export { AudioTrackEffectsDialogContext, useAudioTrackEffectsDialog };
