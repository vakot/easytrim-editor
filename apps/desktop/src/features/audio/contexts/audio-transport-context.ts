import { createContext, useContext } from "react";

interface AudioPlaybackAdapter {
  getCurrentTimeSeconds: () => number | null;
  hasActiveOutput: boolean;
  isReady: boolean;
  pause: () => void;
  prepareAt: (seconds: number) => Promise<void>;
  seek: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  startLeadSeconds: number;
  startPreparedAt: (seconds: number) => Promise<void>;
}

const AudioTransportContext = createContext<AudioPlaybackAdapter | null>(null);

function useAudioPlaybackAdapter(): AudioPlaybackAdapter {
  const transport = useContext(AudioTransportContext);
  if (!transport) throw new Error("Audio transport must be used within AudioPlaybackProvider.");
  return transport;
}

function useAudioPlaybackReady(): boolean {
  return useAudioPlaybackAdapter().isReady;
}

export { AudioTransportContext, useAudioPlaybackAdapter, useAudioPlaybackReady };
export type { AudioPlaybackAdapter };
