import { type CSSProperties, type SyntheticEvent, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPlaybackSpeed } from "@/app/store/slices/editor-tools-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { diagnostics } from "@/lib/diagnostics";

interface CropViewportVideoProps {
  cropIsOpen: boolean;
  onSourceMetadata: (width: number, height: number) => void;
  previewTransform: string;
  sourceFrame: CSSProperties;
  transformOrigin: string;
  viewportTransition: string;
}

function CropViewportVideo({
  cropIsOpen,
  onSourceMetadata,
  previewTransform,
  sourceFrame,
  transformOrigin,
  viewportTransition,
}: CropViewportVideoProps) {
  const { t } = useTranslation();
  const {
    nativeLoopEnabled,
    onCanPlay,
    onEnded: onPlaybackEnded,
    onLoadedMetadata: onPlaybackLoadedMetadata,
    onPause: onPlaybackPause,
    onPlay: onPlaybackPlay,
    onPreviewPlaybackError,
    onTimeUpdate: onPlaybackTimeUpdate,
    setMediaPlaybackRate,
    setVideoElement,
    videoMuted,
    videoRef,
  } = usePlayback();

  const playbackRate = useAppSelector(selectPlaybackSpeed);
  const preview = useAppSelector(selectPreview);
  const reportedUrl = useRef<string | null>(null);
  const sourceUrl = preview.status === "ready" ? preview.value.url : null;
  const previewKind = preview.status === "ready" ? preview.value.kind : null;

  useEffect(() => {
    setMediaPlaybackRate(playbackRate);
  }, [playbackRate, setMediaPlaybackRate, sourceUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) onCanPlay();
  }, [onCanPlay, sourceUrl, videoRef]);

  useEffect(() => {
    const video = videoRef.current;

    return () => video?.pause();
  }, [sourceUrl, videoRef]);

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
    onPlaybackEnded();
  }, [onPlaybackEnded, previewKind]);

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
    onPreviewPlaybackError(previewKind);
  }, [onPreviewPlaybackError, previewKind, sourceUrl]);

  const onLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const { videoHeight, videoWidth } = event.currentTarget;
      onSourceMetadata(videoWidth, videoHeight);
      onPlaybackLoadedMetadata();
    },
    [onPlaybackLoadedMetadata, onSourceMetadata],
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
      onPlaybackPlay();
    },
    [cropIsOpen, onPlaybackPlay, previewKind],
  );

  const onPause = useCallback(() => {
    if (previewKind === null) return;
    diagnostics.event("media.playback.paused", {
      data: { kind: previewKind },
      origin: { type: "internal" },
    });
    onPlaybackPause();
  }, [onPlaybackPause, previewKind]);

  const onLoadStart = useCallback(() => {
    if (previewKind !== null)
      diagnostics.event("media.load.started", {
        data: { kind: previewKind },
        origin: { type: "internal" },
      });
  }, [previewKind]);

  const onStalled = useCallback(() => {
    if (previewKind !== null)
      diagnostics.warn("media.playback.stalled", {
        data: { kind: previewKind },
        origin: { type: "internal" },
      });
  }, [previewKind]);

  const onTimeUpdate = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) =>
      onPlaybackTimeUpdate(event.currentTarget.currentTime),
    [onPlaybackTimeUpdate],
  );

  const onWaiting = useCallback(() => {
    if (previewKind !== null)
      diagnostics.event("media.playback.waiting", {
        data: { kind: previewKind },
        origin: { type: "internal" },
      });
  }, [previewKind]);

  if (sourceUrl === null || previewKind === null) return null;

  return (
    <video
      aria-label={t("preview.accessibility.source")}
      className={`absolute max-w-none cursor-pointer ${viewportTransition}`}
      crossOrigin="anonymous"
      data-playback-rate={playbackRate}
      data-preview-kind={previewKind}
      key={sourceUrl}
      loop={nativeLoopEnabled}
      muted={videoMuted}
      onCanPlay={onCanPlay}
      onEnded={onEnded}
      onError={onError}
      onLoadedMetadata={onLoadedMetadata}
      onLoadStart={onLoadStart}
      onPause={onPause}
      onPlay={onPlay}
      onStalled={onStalled}
      onTimeUpdate={onTimeUpdate}
      onWaiting={onWaiting}
      playsInline
      preload="auto"
      ref={setVideoElement}
      src={sourceUrl}
      style={{
        ...sourceFrame,
        transform: previewTransform,
        transformOrigin,
      }}
    />
  );
}

export { CropViewportVideo };
