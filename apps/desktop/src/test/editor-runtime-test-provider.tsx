import { type ReactNode, type RefObject, useMemo } from "react";

// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  AudioPlaybackContext,
  type AudioPlaybackContract,
} from "@/features/audio/contexts/audio-playback-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  type AudioPlaybackAdapter,
  AudioTransportContext,
} from "@/features/audio/contexts/audio-transport-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies the playback feature context.
import { PlaybackContext } from "@/features/playback/contexts/playback-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies a focused fake controller.
import { PlaybackController } from "@/features/playback/playback-controller";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  PreviewRuntimeContext,
  type PreviewRuntimeContract,
} from "@/features/preview/contexts/preview-runtime-context";

const noOperation = () => undefined;
const videoRef: RefObject<HTMLVideoElement | null> = { current: null };
const preview = {
  isPreviewReady: false,
  onEnded: noOperation,
  onPause: noOperation,
  onPlay: noOperation,
  onPlaybackError: noOperation,
  onTimeUpdate: noOperation,
  onCanPlay: noOperation,
  onPreviewPlaybackError: noOperation,
  previewKey: null,
  isSeekPending: () => false,
  pauseMedia: noOperation,
  playMedia: async () => undefined,
  requestPlaybackFrame: () => null,
  registerMediaObserver: () => noOperation,
  seekMedia: noOperation,
  setPlaybackRate: noOperation,
  setVideoElement: (element: HTMLVideoElement | null) => {
    if (videoRef.current && videoRef.current !== element) videoRef.current.pause();
    videoRef.current = element;
  },
  videoRef,
} satisfies PreviewRuntimeContract;

const audioPlayback = {
  audioMeterRef: { current: null },
  clearLiveAudioTrackGain: noOperation,
  setLiveAudioTrackGain: noOperation,
} satisfies AudioPlaybackContract;

function EditorRuntimeTestProvider({
  children,
  usesWebAudio = false,
}: {
  children: ReactNode;
  usesWebAudio?: boolean;
}) {
  const playbackController = useMemo(
    () =>
      new PlaybackController(
        {
          audio: {
            getCurrentTimeSeconds: () => null,
            hasActiveOutput: usesWebAudio,
            isReady: false,
            pause: noOperation,
            resume: async () => undefined,
            seek: noOperation,
            setPlaybackRate: noOperation,
            startAt: async () => undefined,
          },
          video: {
            getCurrentTimeSeconds: () => null,
            isReady: false,
            isSeekPending: () => false,
            pause: noOperation,
            play: async () => undefined,
            registerMediaObserver: () => noOperation,
            requestPlaybackFrame: () => null,
            seek: noOperation,
            sessionKey: null,
            setCurrentTimeSeconds: noOperation,
            setPlaybackRate: noOperation,
          },
        },
        0,
      ),
    [usesWebAudio],
  );

  const audioTransport = {
    getCurrentTimeSeconds: () => null,
    hasActiveOutput: usesWebAudio,
    isReady: false,
    pause: noOperation,
    resume: async () => undefined,
    seek: noOperation,
    setPlaybackRate: noOperation,
    startAt: async () => undefined,
  } satisfies AudioPlaybackAdapter;

  return (
    <PreviewRuntimeContext.Provider value={preview}>
      <AudioPlaybackContext.Provider value={audioPlayback}>
        <AudioTransportContext.Provider value={audioTransport}>
          <PlaybackContext.Provider value={playbackController}>{children}</PlaybackContext.Provider>
        </AudioTransportContext.Provider>
      </AudioPlaybackContext.Provider>
    </PreviewRuntimeContext.Provider>
  );
}

export { EditorRuntimeTestProvider };
