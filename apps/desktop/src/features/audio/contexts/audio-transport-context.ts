import { createContext, useContext } from "react";

interface AudioPlaybackAdapter {
  getCurrentTimeSeconds: () => number | null;
  hasActiveOutput: boolean;
  isReady: boolean;
  pause: () => void;
  resume: () => Promise<void>;
  seek: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  startAt: (seconds: number) => Promise<void>;
}

const AudioTransportContext = createContext<AudioPlaybackAdapter | null>(null);

function useAudioPlaybackAdapter(): AudioPlaybackAdapter {
  const transport = useContext(AudioTransportContext);
  if (!transport) throw new Error("Audio transport must be used within AudioPlaybackProvider.");
  return transport;
}

const useAudioTransport = useAudioPlaybackAdapter;

export { AudioTransportContext, useAudioPlaybackAdapter, useAudioTransport };
export type { AudioPlaybackAdapter };
