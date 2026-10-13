import type { ReactNode } from "react";
import { useMemo } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { usePreviewRuntime } from "@/features/preview";

import { AudioPlaybackContext } from "./contexts/audio-playback-context";
import { AudioTransportContext } from "./contexts/audio-transport-context";
import { useAudioPlaybackRuntime } from "./hooks/useAudioPlaybackRuntime";

function AudioPlaybackProvider({ children }: { children: ReactNode }) {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const media = useAppSelector(selectSourceMedia);
  const preview = usePreviewRuntime();
  const playback = useAudioPlaybackRuntime({
    activeInstanceId,
    durationMicros: media?.durationMicros ?? 0,
    videoRef: preview.videoRef,
  });

  const audioPlayback = useMemo(
    () => ({
      audioMeterRef: playback.audioMeterRef,
      clearLiveAudioTrackGain: playback.clearLiveAudioTrackGain,
      setLiveAudioTrackGain: playback.setLiveAudioTrackGain,
    }),
    [
      playback.audioMeterRef,
      playback.clearLiveAudioTrackGain,
      playback.setLiveAudioTrackGain,
    ],
  );

  const audioTransport = useMemo(
    () => ({
      isReady: playback.isReady,
      getCurrentTimeSeconds: playback.getCurrentTimeSeconds,
      pause: playback.pause,
      requestPlaybackFrame: playback.requestPlaybackFrame,
      resumeAudioContext: playback.resumeAudioContext,
      setPlaybackRate: playback.setPlaybackRate,
      startAt: playback.startAt,
      syncTo: playback.syncTo,
      usesWebAudio: playback.usesWebAudio,
    }),
    [
      playback.isReady,
      playback.getCurrentTimeSeconds,
      playback.pause,
      playback.requestPlaybackFrame,
      playback.resumeAudioContext,
      playback.setPlaybackRate,
      playback.startAt,
      playback.syncTo,
      playback.usesWebAudio,
    ],
  );

  return (
    <AudioPlaybackContext.Provider value={audioPlayback}>
      <AudioTransportContext.Provider value={audioTransport}>
        {children}
      </AudioTransportContext.Provider>
    </AudioPlaybackContext.Provider>
  );
}

export { AudioPlaybackProvider };
