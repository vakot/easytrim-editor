import { motion, type Transition } from "motion/react";
import { type CSSProperties, type SyntheticEvent, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { useAudioPlaybackMutesPreviewVideo } from "@/features/audio";
import { diagnostics } from "@/lib/diagnostics";

import { useSetPreviewVideoElement } from "../../../contexts/preview-runtime-context";

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
  const setVideoElement = useSetPreviewVideoElement();
  const videoMuted = useAudioPlaybackMutesPreviewVideo();
  const preview = useAppSelector(selectPreview);
  const sourceUrl = preview.status === "ready" ? preview.value.url : null;
  const previewKind = preview.status === "ready" ? preview.value.kind : null;

  useEffect(() => {
    if (previewKind === null) return;
    diagnostics.event("media.source.changed", {
      data: { kind: previewKind },
      origin: { type: "internal" },
    });
  }, [previewKind, sourceUrl]);

  const handlePlay = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (cropIsOpen) event.currentTarget.pause();
    },
    [cropIsOpen],
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
      onLoadStart={onLoadStart}
      onPlay={handlePlay}
      onStalled={onStalled}
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
