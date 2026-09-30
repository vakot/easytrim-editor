import { createContext, type RefObject, useContext } from "react";

import type { StereoAudioMeterNodes } from "../lib/stereo-audio-meter";

interface AudioPlaybackContract {
  audioMeterRef: RefObject<StereoAudioMeterNodes | null>;
  audioPlayheadRef: RefObject<HTMLDivElement | null>;
  clearLiveAudioTrackGain: (streamIndex: number, committedGainDb: number) => void;
  setLiveAudioTrackGain: (streamIndex: number, gainDb: number) => void;
}

const AudioPlaybackContext = createContext<AudioPlaybackContract | null>(null);

function useAudioPlayback() {
  const playback = useContext(AudioPlaybackContext);
  if (!playback) throw new Error("Audio playback must be used within AudioPlaybackProvider.");
  return playback;
}

export { AudioPlaybackContext, useAudioPlayback };
export type { AudioPlaybackContract };
