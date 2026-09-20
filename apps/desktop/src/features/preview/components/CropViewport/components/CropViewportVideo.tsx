import { type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useCropViewportVideo } from "../hooks/useCropViewportVideo";

interface CropViewportVideoProps {
  cropIsOpen: boolean;
  onSourceMetadata: (width: number, height: number) => void;
  previewTransform: string;
  sourceFrame: CSSProperties;
  transformOrigin: string;
  viewportTransition: string;
}

export function CropViewportVideo({
  cropIsOpen,
  onSourceMetadata,
  previewTransform,
  sourceFrame,
  transformOrigin,
  viewportTransition,
}: CropViewportVideoProps) {
  const { t } = useTranslation();
  const video = useCropViewportVideo({ cropIsOpen, onSourceMetadata });

  if (video.sourceUrl === null || video.previewKind === null) return null;

  return (
    <video
      aria-label={t("preview.accessibility.source")}
      className={`absolute max-w-none cursor-pointer ${viewportTransition}`}
      crossOrigin="anonymous"
      data-playback-rate={video.playbackRate}
      data-preview-kind={video.previewKind}
      key={video.sourceUrl}
      loop={video.nativeLoopEnabled}
      muted={video.videoMuted}
      onCanPlay={video.onCanPlay}
      onEnded={video.onEnded}
      onError={video.onError}
      onLoadedMetadata={video.onLoadedMetadata}
      onLoadStart={video.onLoadStart}
      onPause={video.onPause}
      onPlay={video.onPlay}
      onStalled={video.onStalled}
      onTimeUpdate={video.onTimeUpdate}
      onWaiting={video.onWaiting}
      playsInline
      preload="auto"
      ref={video.videoRef}
      src={video.sourceUrl}
      style={{
        ...sourceFrame,
        transform: previewTransform,
        transformOrigin,
      }}
    />
  );
}
