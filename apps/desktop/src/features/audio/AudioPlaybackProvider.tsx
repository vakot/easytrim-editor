import type { ReactNode } from "react";

import { AudioTransportContext } from "./contexts/audio-transport-context";
import { useAudioPlaybackRuntime } from "./hooks/useAudioPlaybackRuntime";

function AudioPlaybackProvider({ children }: { children: ReactNode }) {
  const adapter = useAudioPlaybackRuntime();

  return (
    <AudioTransportContext.Provider value={adapter}>{children}</AudioTransportContext.Provider>
  );
}

export { AudioPlaybackProvider };
