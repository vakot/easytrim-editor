import { createContext, useContext } from "react";

interface AudioPlaybackAdapter {
  getCurrentTimeSeconds: () => number | null;
  isReady: boolean;
  pause: () => void;
  requestPlaybackFrame: (
    callback: (timestamp: number, mediaTimeSeconds: number) => void,
  ) => { cancel: () => void } | null;
  resumeAudioContext: () => Promise<void>;
  setPlaybackRate: (rate: number) => void;
  startAt: (seconds: number) => Promise<void>;
  syncTo: (seconds: number, force?: boolean) => void;
  usesWebAudio: boolean;
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
