import type { ReactNode } from "react";
import { useMemo } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { usePreviewRuntime } from "@/features/preview";

import { AudioPlaybackContext } from "./contexts/audio-playback-context";
import { AudioTransportContext } from "./contexts/audio-transport-context";
import { useAudioPlaybackRuntime } from "./hooks/useAudioPlaybackRuntime";

function AudioPlaybackProvider({ children }: { children: ReactNode }) {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const preview = usePreviewRuntime();
  const playback = useAudioPlaybackRuntime({
    activeInstanceId,
    isPreviewReady: preview.isPreviewReady,
    playbackRate: 1,
    previewKey: preview.previewKey,
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
      pause: playback.pause,
      resumeAt: playback.resumeAt,
      resumeAudioContext: playback.resumeAudioContext,
      setPlaybackRate: playback.setPlaybackRate,
      startAt: playback.startAt,
      syncTo: playback.syncTo,
      usesExternalAudio: playback.usesExternalAudio,
    }),
    [
      playback.isReady,
      playback.pause,
      playback.resumeAt,
      playback.resumeAudioContext,
      playback.setPlaybackRate,
      playback.startAt,
      playback.syncTo,
      playback.usesExternalAudio,
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
