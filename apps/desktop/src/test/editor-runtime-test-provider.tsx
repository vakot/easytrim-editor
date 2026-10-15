import { type ReactNode, type RefObject, useMemo } from "react";

// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  type AudioPlaybackAdapter,
  AudioTransportContext,
} from "@/features/audio/contexts/audio-transport-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies the playback feature context.
import { PlaybackContext } from "@/features/playback/contexts/playback-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies a focused fake controller.
import { PlaybackController } from "@/features/playback/controllers/playback-controller";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  PreviewRuntimeContext,
  type PreviewRuntimeContract,
} from "@/features/preview/contexts/preview-runtime-context";

const noOperation = () => undefined;
const videoRef: RefObject<HTMLVideoElement | null> = { current: null };
const preview = {
  isPreviewReady: false,
  isSeekPending: () => false,
  pauseMedia: noOperation,
  playMedia: async () => 0,
  requestPlaybackFrame: () => null,
  registerMediaObserver: () => noOperation,
  seekMedia: noOperation,
  setVideoElement: (element: HTMLVideoElement | null) => {
    if (videoRef.current && videoRef.current !== element) videoRef.current.pause();
    videoRef.current = element;
  },
  videoRef,
} satisfies PreviewRuntimeContract;

function EditorRuntimeTestProvider({
  children,
  usesWebAudio = false,
}: {
  children: ReactNode;
  usesWebAudio?: boolean;
}) {
  const playbackController = useMemo(() => {
    const controller = new PlaybackController();
    controller.attach(
      1,
      {
        audio: {
          getCurrentTimeSeconds: () => null,
          hasActiveOutput: usesWebAudio,
          isReady: false,
          pause: noOperation,
          prefetchAt: () => undefined,
          prepareAt: async () => undefined,
          registerPlaybackErrorObserver: () => noOperation,
          seek: noOperation,
          startAlignedWithVideoAt: async (seconds: number) => seconds + 0.15,
        },
        video: {
          getCurrentTimeSeconds: () => null,
          getPresentedTimeSeconds: () => null,
          isEnded: () => false,
          isReady: false,
          isSeekPending: () => false,
          pause: noOperation,
          play: async () => 0,
          registerMediaObserver: () => noOperation,
          requestPlaybackFrame: () => null,
          seek: noOperation,
        },
      },
      0,
    );
    return controller;
  }, [usesWebAudio]);

  const audioTransport = {
    getCurrentTimeSeconds: () => null,
    hasActiveOutput: usesWebAudio,
    isReady: false,
    pause: noOperation,
    prefetchAt: () => undefined,
    prepareAt: async () => undefined,
    registerPlaybackErrorObserver: () => noOperation,
    seek: noOperation,
    startAlignedWithVideoAt: async (seconds: number) => seconds + 0.15,
  } satisfies AudioPlaybackAdapter;

  return (
    <PreviewRuntimeContext.Provider value={preview}>
      <AudioTransportContext.Provider value={audioTransport}>
        <PlaybackContext.Provider value={playbackController}>{children}</PlaybackContext.Provider>
      </AudioTransportContext.Provider>
    </PreviewRuntimeContext.Provider>
  );
}

export { EditorRuntimeTestProvider };
