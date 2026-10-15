import { createContext, useContext } from "react";

import type { WaveformDisplayMode } from "../../../lib/waveform-display-mode";

/** A row's waveform display mode, shared by its selector and its menus. */
interface AudioTrackDisplayMode {
  displayMode: WaveformDisplayMode;
  setDisplayMode: (displayMode: WaveformDisplayMode) => void;
}

const AudioTrackDisplayModeContext = createContext<AudioTrackDisplayMode | null>(null);

function useAudioTrackDisplayMode(): AudioTrackDisplayMode {
  const displayMode = useContext(AudioTrackDisplayModeContext);
  if (!displayMode) throw new Error("Audio track display mode must be used within its row.");
  return displayMode;
}

export { AudioTrackDisplayModeContext, useAudioTrackDisplayMode };
