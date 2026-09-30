import { motion, type Transition } from "motion/react";
import { type CSSProperties, type SyntheticEvent, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPlaybackSpeed } from "@/app/store/slices/playback-controls-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { useAudioTransport } from "@/features/audio";
import { usePreviewRuntime } from "@/features/preview";
import { useTimelinePlayback } from "@/features/timeline";
import { diagnostics } from "@/lib/diagnostics";

interface CropViewportVideoProps {
  cropIsOpen: boolean;
  presentationRotation: number;
  style: CSSProperties;
  transition: Transition;
}

function CropViewportVideo({
  cropIsOpen,
  presentationRotation,
  style,
  transition,
}: CropViewportVideoProps) {
  const { t } = useTranslation();
  const playback = useTimelinePlayback();
  const { onCanPlay, onPreviewPlaybackError, setVideoElement, videoRef } = usePreviewRuntime();

  const { usesExternalAudio } = useAudioTransport();
  const loopPlaybackEnabled = useAppSelector(selectLoopPlaybackEnabled);
  const segmentPlaybackEnabled = useAppSelector(selectSegmentPlaybackEnabled);
  const nativeLoopEnabled =
    playback.canInteract &&
    playback.shuttleDirection === 0 &&
    loopPlaybackEnabled &&
    !segmentPlaybackEnabled &&
    !usesExternalAudio;

  const videoMuted = usesExternalAudio && typeof AudioContext === "undefined";

  const playbackRate = useAppSelector(selectPlaybackSpeed);
  const preview = useAppSelector(selectPreview);
  const reportedUrl = useRef<string | null>(null);
  const sourceUrl = preview.status === "ready" ? preview.value.url : null;
  const previewKind = preview.status === "ready" ? preview.value.kind : null;

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, sourceUrl, videoRef]);

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
    playback.onEnded();
  }, [playback, previewKind]);

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
    playback.pause();
    onPreviewPlaybackError(previewKind);
  }, [onPreviewPlaybackError, playback, previewKind, sourceUrl]);

  const onLoadedMetadata = useCallback(() => playback.onLoadedMetadata(), [playback]);

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
    [cropIsOpen, playback, previewKind],
  );

  const onPause = useCallback(() => {
    if (previewKind === null) return;
    diagnostics.event("media.playback.paused", {
      data: { kind: previewKind },
      origin: { type: "internal" },
    });
    playback.onPause();
  }, [playback, previewKind]);

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
      playback.onTimeUpdate(event.currentTarget.currentTime),
    [playback],
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
    <motion.video
      animate={{
        width: style.width,
        height: style.height,
        left: style.left,
        top: style.top,
      }}
      aria-label={t("preview.accessibility.source")}
      className="absolute max-w-none cursor-pointer"
      crossOrigin="anonymous"
      data-playback-rate={playbackRate}
      data-presentation-rotation={presentationRotation}
      data-preview-kind={previewKind}
      initial={false}
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
      style={{ left: style.left, top: style.top }}
      transition={transition}
    />
  );
}

export { CropViewportVideo };
