import { useCallback, useRef, type RefObject } from "react";

import type { PreviewState } from "@/app/session-state";
import { VideoPreview } from "@/features/preview/VideoPreview";
import type { CropRect } from "@/features/preview/utils/crop-geometry";

export interface PreviewPaneContentProps {
  sourceId: string;
  preview: PreviewState;
  playbackRate: number;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  onPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onLoadedMetadata: () => void;
  onTogglePlayback: () => void;
  onPlaybackStarted: () => void;
  onPlaybackPaused: () => void;
  onTimeUpdate: (seconds: number) => void;
  onEnded: () => void;
  onPauseForCrop: () => void;
  onResumeAfterCrop: () => void;
  sourceDimensions?: { width: number; height: number };
  onCropResolutionChange?: (resolution: { width: number; height: number }) => void;
  onCropChange?: (crop: CropRect) => void;
}

export function PreviewPaneContent({
  isPlaying,
  onPlaybackStarted,
  onPlaybackPaused,
  onPauseForCrop,
  onResumeAfterCrop,
  ...videoPreviewProps
}: PreviewPaneContentProps) {
  const cropToolOpenRef = useRef(false);
  const resumeAfterCropRef = useRef(false);

  const handleCropToolOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        if (cropToolOpenRef.current) return;
        cropToolOpenRef.current = true;
        resumeAfterCropRef.current = isPlaying;
        if (resumeAfterCropRef.current) {
          onPauseForCrop();
        }
        return;
      }

      if (!cropToolOpenRef.current) return;
      cropToolOpenRef.current = false;
      if (!resumeAfterCropRef.current) return;
      resumeAfterCropRef.current = false;
      onResumeAfterCrop();
    },
    [isPlaying, onPauseForCrop, onResumeAfterCrop],
  );

  return (
    <VideoPreview
      {...videoPreviewProps}
      onPlay={onPlaybackStarted}
      onPause={onPlaybackPaused}
      onCropToolOpenChange={handleCropToolOpenChange}
    />
  );
}
