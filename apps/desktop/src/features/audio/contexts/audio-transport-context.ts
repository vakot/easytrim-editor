import { createContext, useContext } from "react";

interface AudioPlaybackAdapter {
  getCurrentTimeSeconds: () => number | null;
  hasActiveOutput: boolean;
  isReady: boolean;
  pause: () => void;
  prefetchAt: (seconds: number) => void;
  prepareAt: (seconds: number) => Promise<void>;
  registerPlaybackErrorObserver: (observer: () => void) => () => void;
  seek: (seconds: number) => void;
  startAlignedWithVideoAt: (videoPositionSeconds: number) => Promise<number>;
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

function useAudioPlaybackHasActiveOutput(): boolean {
  return useAudioPlaybackAdapter().hasActiveOutput;
}

export {
  AudioTransportContext,
  useAudioPlaybackAdapter,
  useAudioPlaybackHasActiveOutput,
  useAudioPlaybackReady,
};
export type { AudioPlaybackAdapter };
