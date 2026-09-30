import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectPlaybackSpeed } from "@/app/store/slices/playback-controls-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";
import { handlePreviewPlaybackError } from "@/app/store/thunks/source-media-thunks";
import { diagnostics } from "@/lib/diagnostics";

import type { PreviewMediaObserver } from "./contexts/preview-runtime-context";
import { PreviewRuntimeContext } from "./contexts/preview-runtime-context";
import { requestPreviewPlaybackFrame } from "./lib/preview-frame-scheduler";
import { createPreviewSeekScheduler } from "./lib/preview-seek-scheduler";

function PreviewPlaybackProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const sourceLoadToken = useAppSelector(selectSourceLoadToken);
  const playbackRate = useAppSelector(selectPlaybackSpeed);

  const preview = useAppSelector(selectPreview);
  const previewKey =
    sourcePath && preview.status === "ready"
      ? `${sourceLoadToken}:${sourcePath}:${preview.value.url}`
      : null;

  const previewKind = preview.status === "ready" ? preview.value.kind : null;

  const [readyPreviewKey, setReadyPreviewKey] = useState<string | null>(null);
  const [isNativeLoopEnabled, setIsNativeLoopEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const observerRef = useRef<PreviewMediaObserver | null>(null);
  const seekSchedulerRef = useRef<{
    scheduler: ReturnType<typeof createPreviewSeekScheduler>;
    video: HTMLVideoElement;
  } | null>(null);

  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    if (videoRef.current && videoRef.current !== element) videoRef.current.pause();
    if (seekSchedulerRef.current?.video !== element) {
      seekSchedulerRef.current?.scheduler.dispose();
      seekSchedulerRef.current = null;
    }
    videoRef.current = element;
  }, []);

  const getMediaState = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    return {
      currentTimeSeconds: video.currentTime,
      paused: video.paused,
      seeking: video.seeking,
    };
  }, []);

  const isSeekPending = useCallback(
    () => seekSchedulerRef.current?.scheduler.isPending ?? false,
    [],
  );

  const pauseMedia = useCallback(() => videoRef.current?.pause(), []);

  const playMedia = useCallback(() => {
    const video = videoRef.current;
    return video ? video.play() : Promise.reject(new Error("The preview video is unavailable."));
  }, []);

  const seekMedia = useCallback((seconds: number, approximate: boolean, onSettled?: () => void) => {
    const video = videoRef.current;
    if (!video) return;
    if (seekSchedulerRef.current?.video !== video) {
      seekSchedulerRef.current?.scheduler.dispose();
      seekSchedulerRef.current = { scheduler: createPreviewSeekScheduler(video), video };
    }
    seekSchedulerRef.current.scheduler.seek(seconds, approximate, onSettled);
  }, []);

  const requestPlaybackFrame = useCallback(
    (callback: (timestamp: number, mediaTimeSeconds: number) => void) => {
      const video = videoRef.current;
      return video ? requestPreviewPlaybackFrame(video, callback) : null;
    },
    [],
  );

  const onCanPlay = useCallback(() => {
    if (previewKey) setReadyPreviewKey(previewKey);
  }, [previewKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) onCanPlay();
  }, [onCanPlay, previewKey]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, previewKey]);

  useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, [previewKey]);

  useEffect(
    () => () => {
      seekSchedulerRef.current?.scheduler.dispose();
      seekSchedulerRef.current = null;
    },
    [],
  );

  const onPreviewPlaybackError = useCallback(
    (previewKind: "source" | "proxy") => {
      if (sourcePath) void dispatch(handlePreviewPlaybackError(sourcePath, previewKind));
    },
    [dispatch, sourcePath],
  );

  const registerMediaObserver = useCallback((observer: PreviewMediaObserver) => {
    observerRef.current = observer;
    return () => {
      if (observerRef.current === observer) observerRef.current = null;
    };
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, []);

  const onLoadedMetadata = useCallback(() => observerRef.current?.onLoadedMetadata(), []);
  const onPause = useCallback(() => {
    if (previewKind !== null)
      diagnostics.event("media.playback.paused", {
        data: { kind: previewKind },
        origin: { type: "internal" },
      });
    observerRef.current?.onPause();
  }, [previewKind]);

  const onPlay = useCallback(() => {
    if (previewKind !== null)
      diagnostics.event("media.playback.started", {
        data: { kind: previewKind },
        origin: { type: "internal" },
      });
    observerRef.current?.onPlay();
  }, [previewKind]);

  const onEnded = useCallback(() => {
    if (previewKind !== null)
      diagnostics.event("media.playback.ended", {
        data: { kind: previewKind },
        origin: { type: "internal" },
      });
    observerRef.current?.onEnded();
  }, [previewKind]);

  const onTimeUpdate = useCallback((seconds: number) => {
    observerRef.current?.onTimeUpdate(seconds);
  }, []);

  const onPlaybackError = useCallback(() => {
    if (previewKind === null || !sourcePath) return;
    diagnostics.error(
      "media.playback.failed",
      {
        code: "media_element_error",
        message: "The preview media element reported an error.",
      },
      { data: { kind: previewKind }, origin: { type: "internal" } },
    );
    observerRef.current?.onPlaybackError();
    onPreviewPlaybackError(previewKind);
  }, [onPreviewPlaybackError, previewKind, sourcePath]);

  const runtime = useMemo(
    () => ({
      isPreviewReady: previewKey !== null && readyPreviewKey === previewKey,
      isNativeLoopEnabled,
      getMediaState,
      isSeekPending,
      onEnded,
      onLoadedMetadata,
      onPause,
      onPlay,
      onPlaybackError,
      onTimeUpdate,
      onCanPlay,
      onPreviewPlaybackError,
      previewKey,
      pauseMedia,
      playMedia,
      requestPlaybackFrame,
      registerMediaObserver,
      seekMedia,
      setNativeLoopEnabled: setIsNativeLoopEnabled,
      setPlaybackRate,
      setVideoElement,
      videoRef,
    }),
    [
      isNativeLoopEnabled,
      getMediaState,
      isSeekPending,
      onCanPlay,
      onEnded,
      onLoadedMetadata,
      onPause,
      onPlay,
      onPlaybackError,
      onPreviewPlaybackError,
      onTimeUpdate,
      previewKey,
      pauseMedia,
      playMedia,
      requestPlaybackFrame,
      readyPreviewKey,
      registerMediaObserver,
      seekMedia,
      setPlaybackRate,
      setVideoElement,
    ],
  );

  return (
    <PreviewRuntimeContext.Provider value={runtime}>{children}</PreviewRuntimeContext.Provider>
  );
}

export { PreviewPlaybackProvider };
