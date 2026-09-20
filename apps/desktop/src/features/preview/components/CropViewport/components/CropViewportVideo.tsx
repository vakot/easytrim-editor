import type { CSSProperties } from "react";
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
  const {
    nativeLoopEnabled,
    onCanPlay,
    onEnded,
    onError,
    onLoadedMetadata,
    onLoadStart,
    onPause,
    onPlay,
    onStalled,
    onTimeUpdate,
    onWaiting,
    playbackRate,
    previewKind,
    setVideoElement,
    sourceUrl,
    videoMuted,
  } = useCropViewportVideo({ cropIsOpen, onSourceMetadata });

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
