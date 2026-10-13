import { createContext, type RefObject, useContext, useMemo } from "react";

interface PreviewMediaObserver {
  onEnded: () => void;
  onPause: () => void;
  onPlay: () => void;
  onPlaybackError: () => void;
  onTimeUpdate: (seconds: number) => void;
}

interface PreviewPlaybackFrame {
  cancel: () => void;
}

interface PreviewVideoAdapter {
  isReady: boolean;
  isSeekPending: () => boolean;
  pause: () => void;
  play: () => Promise<void>;
  registerMediaObserver: (observer: PreviewMediaObserver) => () => void;
  requestPlaybackFrame: (
    callback: (timestamp: number, mediaTimeSeconds: number) => void,
  ) => PreviewPlaybackFrame | null;
  seek: (seconds: number, approximate: boolean, onSettled?: () => void) => void;
  sessionKey: string | null;
  setPlaybackRate: (rate: number) => void;
}

interface PreviewRuntimeContract {
  isPreviewReady: boolean;
  isSeekPending: () => boolean;
  onCanPlay: () => void;
  onEnded: () => void;
  onPause: () => void;
  onPlay: () => void;
  onPlaybackError: () => void;
  onPreviewPlaybackError: (previewKind: "source" | "proxy") => void;
  onTimeUpdate: (seconds: number) => void;
  pauseMedia: () => void;
  playMedia: () => Promise<void>;
  previewKey: string | null;
  registerMediaObserver: (observer: PreviewMediaObserver) => () => void;
  requestPlaybackFrame: (
    callback: (timestamp: number, mediaTimeSeconds: number) => void,
  ) => PreviewPlaybackFrame | null;
  seekMedia: (seconds: number, approximate: boolean, onSettled?: () => void) => void;
  setPlaybackRate: (rate: number) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const PreviewRuntimeContext = createContext<PreviewRuntimeContract | null>(null);

function usePreviewRuntime(): PreviewRuntimeContract {
  const runtime = useContext(PreviewRuntimeContext);
  if (!runtime) throw new Error("Preview runtime must be used within PreviewPlaybackProvider.");
  return runtime;
}

function usePreviewVideoAdapter(): PreviewVideoAdapter {
  const {
    isPreviewReady: isReady,
    isSeekPending,
    pauseMedia: pause,
    playMedia: play,
    previewKey: sessionKey,
    registerMediaObserver,
    requestPlaybackFrame,
    seekMedia: seek,
    setPlaybackRate,
  } = usePreviewRuntime();

  return useMemo(
    () => ({
      isReady,
      isSeekPending,
      pause,
      play,
      registerMediaObserver,
      requestPlaybackFrame,
      seek,
      sessionKey,
      setPlaybackRate,
    }),
    [
      isReady,
      isSeekPending,
      pause,
      play,
      registerMediaObserver,
      requestPlaybackFrame,
      seek,
      sessionKey,
      setPlaybackRate,
    ],
  );
}

export { PreviewRuntimeContext, usePreviewRuntime, usePreviewVideoAdapter };
export type {
  PreviewMediaObserver,
  PreviewPlaybackFrame,
  PreviewRuntimeContract,
  PreviewVideoAdapter,
};
