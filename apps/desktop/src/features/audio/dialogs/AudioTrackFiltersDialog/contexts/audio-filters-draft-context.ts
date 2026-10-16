import { createContext, type Dispatch, useContext } from "react";

import type { AudioFiltersDraft, AudioFiltersDraftAction } from "../lib/audio-filters-draft";

interface AudioFiltersDraftContextValue {
  dispatch: Dispatch<AudioFiltersDraftAction>;
  draft: AudioFiltersDraft;
}

const AudioFiltersDraftContext = createContext<AudioFiltersDraftContextValue | null>(null);

function useAudioFiltersDraft(): AudioFiltersDraftContextValue {
  const value = useContext(AudioFiltersDraftContext);
  if (!value) throw new Error("Audio filter editors must be used within the filters dialog.");
  return value;
}

export { AudioFiltersDraftContext, useAudioFiltersDraft };
