import { createContext, type RefObject, useCallback, useContext, useMemo } from "react";

import { presentedTimeSeconds } from "../lib/preview-frame-scheduler";

interface PreviewMediaObserver {
  onEnded: () => void;
  onPause: (isPaused: boolean) => void;
  onPlay: () => void;
  onPlaybackError: () => void;
  onTimeUpdate: (seconds: number) => void;
}

interface PreviewPlaybackFrame {
  cancel: () => void;
}

interface PreviewVideoAdapter {
  getCurrentTimeSeconds: () => number | null;
  /** Timestamp of the frame on screen, which can trail or lead the transport clock. */
  getPresentedTimeSeconds: () => number | null;
  isEnded: () => boolean;
  isReady: boolean;
  isSeekPending: () => boolean;
  pause: () => void;
  /** Resolves with the presented media position projected to the current performance time. */
  play: () => Promise<number>;
  registerMediaObserver: (observer: PreviewMediaObserver) => () => void;
  /** Calls back on the next display refresh with the timestamp of the frame on screen. */
  requestPlaybackFrame: (
    callback: (timestamp: number, presentedTimeSeconds: number) => void,
  ) => PreviewPlaybackFrame | null;
  seek: (seconds: number, approximate: boolean, onSettled?: () => void) => void;
}

interface PreviewRuntimeContract {
  isPreviewReady: boolean;
  isSeekPending: () => boolean;
  pauseMedia: () => void;
  playMedia: () => Promise<number>;
  registerMediaObserver: (observer: PreviewMediaObserver) => () => void;
  requestPlaybackFrame: (
    callback: (timestamp: number, mediaTimeSeconds: number) => void,
  ) => PreviewPlaybackFrame | null;
  seekMedia: (seconds: number, approximate: boolean, onSettled?: () => void) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const PreviewRuntimeContext = createContext<PreviewRuntimeContract | null>(null);

function usePreviewRuntime(): PreviewRuntimeContract {
  const runtime = useContext(PreviewRuntimeContext);
  if (!runtime) throw new Error("Preview runtime must be used within PreviewPlaybackProvider.");
  return runtime;
}

function usePreviewReady(): boolean {
  return usePreviewRuntime().isPreviewReady;
}

function usePreviewVideoRef(): RefObject<HTMLVideoElement | null> {
  return usePreviewRuntime().videoRef;
}

function useSetPreviewVideoElement() {
  return usePreviewRuntime().setVideoElement;
}

function usePreviewVideoAdapter(): PreviewVideoAdapter {
  const {
    isPreviewReady: isReady,
    isSeekPending,
    pauseMedia: pause,
    playMedia: play,
    registerMediaObserver,
    requestPlaybackFrame,
    seekMedia: seek,
    videoRef,
  } = usePreviewRuntime();

  const getCurrentTimeSeconds = useCallback(
    () => videoRef.current?.currentTime ?? null,
    [videoRef],
  );

  const getPresentedTimeSeconds = useCallback(
    () => (videoRef.current ? presentedTimeSeconds(videoRef.current) : null),
    [videoRef],
  );

  const isEnded = useCallback(() => videoRef.current?.ended ?? false, [videoRef]);

  return useMemo(
    () => ({
      isReady,
      isSeekPending,
      getCurrentTimeSeconds,
      getPresentedTimeSeconds,
      isEnded,
      pause,
      play,
      registerMediaObserver,
      requestPlaybackFrame,
      seek,
    }),
    [
      isReady,
      isSeekPending,
      getCurrentTimeSeconds,
      getPresentedTimeSeconds,
      isEnded,
      pause,
      play,
      registerMediaObserver,
      requestPlaybackFrame,
      seek,
    ],
  );
}

export {
  PreviewRuntimeContext,
  usePreviewReady,
  usePreviewVideoAdapter,
  usePreviewVideoRef,
  useSetPreviewVideoElement,
};
export type {
  PreviewMediaObserver,
  PreviewPlaybackFrame,
  PreviewRuntimeContract,
  PreviewVideoAdapter,
};
