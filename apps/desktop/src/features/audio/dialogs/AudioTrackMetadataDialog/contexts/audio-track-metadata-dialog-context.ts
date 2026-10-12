import { createContext, useContext } from "react";

const AudioTrackMetadataDialogContext = createContext<{
  openMetadataDialog: () => Promise<void>;
  preloadMetadata: () => void;
} | null>(null);

function useAudioTrackMetadataDialog() {
  const context = useContext(AudioTrackMetadataDialogContext);
  if (!context) {
    throw new Error("useAudioTrackMetadataDialog must be used within AudioTrackMetadataDialog");
  }
  return context;
}

export { AudioTrackMetadataDialogContext, useAudioTrackMetadataDialog };
