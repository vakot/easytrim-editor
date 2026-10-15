import { createContext, useContext } from "react";

import type { StereoAudioMeterNodes } from "../lib/stereo-audio-meter";

interface AudioPlaybackAdapter {
  getCurrentTimeSeconds: () => number | null;
  /** The live output meter of the current session, read when a meter needs to sample it. */
  getMeter: () => StereoAudioMeterNodes | null;
  hasActiveOutput: boolean;
  isReady: boolean;
  pause: () => void;
  prefetchAt: (seconds: number) => void;
  prepareAt: (seconds: number) => Promise<void>;
  registerPlaybackErrorObserver: (observer: () => void) => () => void;
  seek: (seconds: number) => void;
  /** Previews the playback volume while it is adjusted; `null` restores the committed volume. */
  setLiveOutputVolume: (volumePercent: number | null) => void;
  /** Previews a track gain while it is adjusted; `null` restores the committed gain. */
  setLiveTrackGain: (streamIndex: number, gainDb: number | null) => void;
  /** Source seconds per second; a running playback restarts from where it is. */
  setPlaybackRate: (rate: number) => void;
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
