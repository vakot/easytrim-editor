import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
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
  const preview = useAppSelector(selectPreview);
  const previewKey =
    sourcePath && preview.status === "ready"
      ? `${sourceLoadToken}:${sourcePath}:${preview.value.url}`
      : null;

  const previewKind = preview.status === "ready" ? preview.value.kind : null;

  const [readyPreviewKey, setReadyPreviewKey] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const observerRef = useRef<PreviewMediaObserver | null>(null);
  const sourcePathRef = useRef(sourcePath);
  const previewKeyRef = useRef(previewKey);
  const previewKindRef = useRef(previewKind);
  const removeVideoListenersRef = useRef<(() => void) | null>(null);
  const reportedErrorsRef = useRef(new WeakSet<HTMLVideoElement>());
  const seekSchedulerRef = useRef<{
    scheduler: ReturnType<typeof createPreviewSeekScheduler>;
    video: HTMLVideoElement;
  } | null>(null);

  useLayoutEffect(() => {
    sourcePathRef.current = sourcePath;
    previewKeyRef.current = previewKey;
    previewKindRef.current = previewKind;
  }, [previewKey, previewKind, sourcePath]);

  const setVideoElement = useCallback(
    (element: HTMLVideoElement | null) => {
      const currentVideo = videoRef.current;
      if (currentVideo && currentVideo !== element) currentVideo.pause();
      removeVideoListenersRef.current?.();
      removeVideoListenersRef.current = null;

      if (seekSchedulerRef.current?.video !== element) {
        seekSchedulerRef.current?.scheduler.dispose();
        seekSchedulerRef.current = null;
      }
      videoRef.current = element;
      if (!element) return;

      const onCanPlay = () => {
        const key = previewKeyRef.current;
        if (key) setReadyPreviewKey(key);
      };

      const onPause = () => {
        const kind = previewKindRef.current;
        if (kind !== null) {
          diagnostics.event("media.playback.paused", {
            data: { kind },
            origin: { type: "internal" },
          });
        }
        observerRef.current?.onPause(element.paused);
      };

      const onPlay = () => {
        const kind = previewKindRef.current;
        if (kind !== null) {
          diagnostics.event("media.playback.started", {
            data: { kind },
            origin: { type: "internal" },
          });
        }
        observerRef.current?.onPlay();
      };

      const onEnded = () => {
        const kind = previewKindRef.current;
        if (kind !== null) {
          diagnostics.event("media.playback.ended", {
            data: { kind },
            origin: { type: "internal" },
          });
        }
        observerRef.current?.onEnded();
      };

      const onTimeUpdate = () => observerRef.current?.onTimeUpdate(element.currentTime);
      const onError = () => {
        const kind = previewKindRef.current;
        const path = sourcePathRef.current;
        if (kind === null || !path || reportedErrorsRef.current.has(element)) return;
        reportedErrorsRef.current.add(element);
        diagnostics.error(
          "media.playback.failed",
          {
            code: "media_element_error",
            message: "The preview media element reported an error.",
          },
          { data: { kind }, origin: { type: "internal" } },
        );
        observerRef.current?.onPlaybackError();
        void dispatch(handlePreviewPlaybackError(path, kind));
      };

      const listeners = [
        ["canplay", onCanPlay],
        ["ended", onEnded],
        ["error", onError],
        ["pause", onPause],
        ["play", onPlay],
        ["timeupdate", onTimeUpdate],
      ] as const;

      for (const [eventName, listener] of listeners) element.addEventListener(eventName, listener);
      removeVideoListenersRef.current = () => {
        for (const [eventName, listener] of listeners) {
          element.removeEventListener(eventName, listener);
        }
      };
    },
    [dispatch],
  );

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
    const video = videoRef.current;
    return () => video?.pause();
  }, [previewKey]);

  useEffect(
    () => () => {
      removeVideoListenersRef.current?.();
      removeVideoListenersRef.current = null;
      seekSchedulerRef.current?.scheduler.dispose();
      seekSchedulerRef.current = null;
    },
    [],
  );

  const registerMediaObserver = useCallback((observer: PreviewMediaObserver) => {
    observerRef.current = observer;
    return () => {
      if (observerRef.current === observer) observerRef.current = null;
    };
  }, []);

  const runtime = useMemo(
    () => ({
      isPreviewReady: previewKey !== null && readyPreviewKey === previewKey,
      isSeekPending,
      pauseMedia,
      playMedia,
      registerMediaObserver,
      requestPlaybackFrame,
      seekMedia,
      setVideoElement,
      videoRef,
    }),
    [
      isSeekPending,
      pauseMedia,
      playMedia,
      previewKey,
      readyPreviewKey,
      registerMediaObserver,
      requestPlaybackFrame,
      seekMedia,
      setVideoElement,
    ],
  );

  return (
    <PreviewRuntimeContext.Provider value={runtime}>{children}</PreviewRuntimeContext.Provider>
  );
}

export { PreviewPlaybackProvider };
