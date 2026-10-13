import { motion, type Transition } from "motion/react";
import { type CSSProperties, type SyntheticEvent, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { useAudioTransport } from "@/features/audio";
import { usePreviewRuntime } from "@/features/preview";
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
  const {
    onCanPlay,
    onEnded,
    onPause,
    onPlay,
    onPlaybackError,
    onTimeUpdate,
    setVideoElement,
  } = usePreviewRuntime();

  const { usesWebAudio } = useAudioTransport();
  const videoMuted = usesWebAudio;
  const preview = useAppSelector(selectPreview);
  const reportedUrl = useRef<string | null>(null);
  const sourceUrl = preview.status === "ready" ? preview.value.url : null;
  const previewKind = preview.status === "ready" ? preview.value.kind : null;

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

  const onError = useCallback(() => {
    if (previewKind === null || sourceUrl === null) return;
    if (reportedUrl.current === sourceUrl) return;
    reportedUrl.current = sourceUrl;
    onPlaybackError();
  }, [onPlaybackError, previewKind, sourceUrl]);

  const handlePlay = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (cropIsOpen) {
        event.currentTarget.pause();
        return;
      }
      onPlay();
    },
    [cropIsOpen, onPlay],
  );

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
      data-presentation-rotation={presentationRotation}
      data-preview-kind={previewKind}
      initial={false}
      key={sourceUrl}
      muted={videoMuted}
      onCanPlay={onCanPlay}
      onEnded={onEnded}
      onError={onError}
      onLoadStart={onLoadStart}
      onPause={onPause}
      onPlay={handlePlay}
      onStalled={onStalled}
      onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
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
