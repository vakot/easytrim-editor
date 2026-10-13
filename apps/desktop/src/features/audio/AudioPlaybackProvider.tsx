import type { ReactNode } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";

import { AudioPlaybackContext } from "./contexts/audio-playback-context";
import { AudioTransportContext } from "./contexts/audio-transport-context";
import { useAudioPlaybackRuntime } from "./hooks/useAudioPlaybackRuntime";

function AudioPlaybackProvider({ children }: { children: ReactNode }) {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const media = useAppSelector(selectSourceMedia);
  const playback = useAudioPlaybackRuntime({
    activeInstanceId,
    durationMicros: media?.durationMicros ?? 0,
  });

  return (
    <AudioPlaybackContext.Provider value={playback.controls}>
      <AudioTransportContext.Provider value={playback.adapter}>
        {children}
      </AudioTransportContext.Provider>
    </AudioPlaybackContext.Provider>
  );
}

export { AudioPlaybackProvider };
