import { type SyntheticEvent, useCallback, useEffect, useRef } from "react";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPlaybackSpeed } from "@/app/store/slices/editor-tools-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { diagnostics } from "@/lib/diagnostics";

interface UseCropViewportVideoOptions {
  cropIsOpen: boolean;
  onSourceMetadata: (width: number, height: number) => void;
}

export function useCropViewportVideo({
  cropIsOpen,
  onSourceMetadata,
}: UseCropViewportVideoOptions) {
  const playback = usePlayback();
  const playbackRate = useAppSelector(selectPlaybackSpeed);
  const preview = useAppSelector(selectPreview);
  const reportedUrl = useRef<string | null>(null);
  const sourceUrl = preview.status === "ready" ? preview.value.url : null;
  const previewKind = preview.status === "ready" ? preview.value.kind : null;

  useEffect(() => {
    if (playback.videoRef.current) playback.videoRef.current.playbackRate = playbackRate;
  }, [playback.videoRef, playbackRate, sourceUrl]);

  useEffect(() => {
    const video = playback.videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) playback.onCanPlay();
  }, [playback.onCanPlay, playback.videoRef, sourceUrl]);

  useEffect(() => {
    const video = playback.videoRef.current;
    return () => video?.pause();
  }, [playback.videoRef, sourceUrl]);

  useEffect(() => {
    if (previewKind === null) return;
    diagnostics.event("media.source.changed", {
      data: { kind: previewKind },
      origin: { type: "internal" },
    });
  }, [previewKind, sourceUrl]);

  useEffect(() => {
    reportedUrl.current = null;
  }, [sourceUrl]);

  const onEnded = useCallback(() => {
    if (previewKind === null) return;
    diagnostics.event("media.playback.ended", {
      data: { kind: previewKind },
      origin: { type: "internal" },
    });
    playback.onEnded();
  }, [playback.onEnded, previewKind]);

  const onError = useCallback(() => {
    if (previewKind === null || sourceUrl === null) return;
    diagnostics.error(
      "media.playback.failed",
      {
        code: "media_element_error",
        message: "The preview media element reported an error.",
      },
      { data: { kind: previewKind }, origin: { type: "internal" } },
    );
    if (reportedUrl.current === sourceUrl) return;
    reportedUrl.current = sourceUrl;
    playback.onPreviewPlaybackError(previewKind);
  }, [playback.onPreviewPlaybackError, previewKind, sourceUrl]);

  const onLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const { videoHeight, videoWidth } = event.currentTarget;
      onSourceMetadata(videoWidth, videoHeight);
      playback.onLoadedMetadata();
    },
    [onSourceMetadata, playback.onLoadedMetadata],
  );

  const onPlay = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (cropIsOpen) {
        event.currentTarget.pause();
        return;
      }
      if (previewKind === null) return;
      diagnostics.event("media.playback.started", {
        data: { kind: previewKind },
        origin: { type: "internal" },
      });
      playback.onPlay();
    },
    [cropIsOpen, playback.onPlay, previewKind],
  );

  const onPause = useCallback(() => {
    if (previewKind === null) return;
    diagnostics.event("media.playback.paused", {
      data: { kind: previewKind },
      origin: { type: "internal" },
    });
    playback.onPause();
  }, [playback.onPause, previewKind]);

  return {
    onCanPlay: playback.onCanPlay,
    onEnded,
    onError,
    onLoadedMetadata,
    onLoadStart: () => {
      if (previewKind !== null)
        diagnostics.event("media.load.started", {
          data: { kind: previewKind },
          origin: { type: "internal" },
        });
    },
    onPause,
    onPlay,
    onStalled: () => {
      if (previewKind !== null)
        diagnostics.warn("media.playback.stalled", {
          data: { kind: previewKind },
          origin: { type: "internal" },
        });
    },
    onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) =>
      playback.onTimeUpdate(event.currentTarget.currentTime),
    onWaiting: () => {
      if (previewKind !== null)
        diagnostics.event("media.playback.waiting", {
          data: { kind: previewKind },
          origin: { type: "internal" },
        });
    },
    playbackRate,
    previewKind,
    sourceUrl,
    videoMuted: playback.videoMuted,
    videoRef: playback.videoRef,
    nativeLoopEnabled: playback.nativeLoopEnabled,
  };
}
