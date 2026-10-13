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

function getVideoState(video: HTMLVideoElement) {
  return {
    currentTimeSeconds: video.currentTime,
    durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
    ended: video.ended,
    paused: video.paused,
    readyState: video.readyState,
    seeking: video.seeking,
  };
}

function debugVideoEvent(
  event: string,
  video: HTMLVideoElement,
  data: Record<string, boolean | number | string> = {},
) {
  if (!import.meta.env.DEV) return;
  console.debug(`[preview] ${event}`, { ...getVideoState(video), ...data });
}

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
  const seekSequenceRef = useRef(0);
  const lastSeekRequestRef = useRef<{
    awaitingFrame: boolean;
    id: number;
    seconds: number;
  } | null>(null);

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
      if (currentVideo !== element) lastSeekRequestRef.current = null;
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
        debugVideoEvent("canplay", element);
      };

      const onLoadedData = () => {
        debugVideoEvent("loadeddata", element);
      };

      const onSeeking = () => {
        debugVideoEvent("seeking", element);
      };

      const onSeeked = () => {
        debugVideoEvent("seeked", element);
      };

      const onPlaying = () => {
        debugVideoEvent("playing", element);
      };

      const onPause = () => {
        debugVideoEvent("pause event", element);
        const kind = previewKindRef.current;
        if (kind !== null) {
          diagnostics.event("media.playback.paused", {
            data: { ...getVideoState(element), kind },
            origin: { type: "internal" },
          });
        }
        observerRef.current?.onPause(element.paused);
      };

      const onPlay = () => {
        debugVideoEvent("play event", element);
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
        debugVideoEvent("ended event", element);
        const kind = previewKindRef.current;
        if (kind !== null) {
          diagnostics.event("media.playback.ended", {
            data: { ...getVideoState(element), kind },
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
        ["loadeddata", onLoadedData],
        ["pause", onPause],
        ["play", onPlay],
        ["playing", onPlaying],
        ["seeked", onSeeked],
        ["seeking", onSeeking],
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
    if (!video) return Promise.reject(new Error("The preview video is unavailable."));
    debugVideoEvent("play requested", video);
    return video.play().then(
      () => {
        debugVideoEvent("play resolved", video);
      },
      (error: unknown) => {
        diagnostics.error("media.play.rejected", error, {
          data: getVideoState(video),
          origin: { type: "internal" },
        });
        throw error;
      },
    );
  }, []);

  const seekMedia = useCallback((seconds: number, approximate: boolean, onSettled?: () => void) => {
    const video = videoRef.current;
    if (!video) return;
    if (seekSchedulerRef.current?.video !== video) {
      seekSchedulerRef.current?.scheduler.dispose();
      seekSchedulerRef.current = { scheduler: createPreviewSeekScheduler(video), video };
    }

    const scheduler = seekSchedulerRef.current.scheduler;
    const previous = lastSeekRequestRef.current;
    if (scheduler.isPending && previous) {
      debugVideoEvent("seek superseded", video, {
        requestId: previous.id,
        requestedSeconds: previous.seconds,
      });
    }

    const request = {
      awaitingFrame: true,
      id: ++seekSequenceRef.current,
      seconds,
    };

    lastSeekRequestRef.current = request;
    debugVideoEvent("seek requested", video, {
      approximate,
      requestId: request.id,
      requestedSeconds: seconds,
    });

    scheduler.seek(seconds, approximate, () => {
      if (lastSeekRequestRef.current?.id === request.id) {
        debugVideoEvent("seek settled", video, {
          requestId: request.id,
          requestedSeconds: seconds,
        });
      }
      onSettled?.();
    });
  }, []);

  const requestPlaybackFrame = useCallback(
    (callback: (timestamp: number, mediaTimeSeconds: number) => void) => {
      const video = videoRef.current;
      if (!video) return null;
      return requestPreviewPlaybackFrame(video, (timestamp, mediaTimeSeconds) => {
        const seekRequest = lastSeekRequestRef.current;
        if (seekRequest?.awaitingFrame) {
          seekRequest.awaitingFrame = false;
          debugVideoEvent("frame after seek", video, {
            mediaTimeSeconds,
            requestId: seekRequest.id,
            requestedSeconds: seekRequest.seconds,
            timestamp,
          });
        }
        callback(timestamp, mediaTimeSeconds);
      });
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
