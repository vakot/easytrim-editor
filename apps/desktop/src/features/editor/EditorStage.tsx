import { useEffect, useRef, useState } from "react";

import type { PreviewState } from "../../app/session-state";
import { clampToTrim, type TrimRange } from "../../domain/trim";
import type { FrameRate } from "../../lib/tauri/media";
import { VideoPreview } from "../preview/VideoPreview";
import { TrimTimeline } from "../timeline/TrimTimeline";

interface EditorStageProps {
  sourceId: string;
  preview: PreviewState;
  trim: TrimRange;
  frameRate?: FrameRate;
  onPreviewPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onTrimChange: (trim: TrimRange) => void;
}

export function EditorStage({
  sourceId,
  preview,
  trim,
  frameRate,
  onPreviewPlaybackError,
  onTrimChange,
}: EditorStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const trimRef = useRef(trim);
  trimRef.current = trim;
  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const displayedPlayheadMicros = clampToTrim(playheadMicros, trim);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  function handleSeek(micros: number) {
    const clamped = clampToTrim(micros, trimRef.current);
    setPlayheadMicros(clamped);
    seekVideo(videoRef.current, clamped);
  }

  function handleTimeUpdate(seconds: number) {
    const currentTrim = trimRef.current;
    const currentMicros = Math.round(seconds * 1_000_000);
    if (currentMicros >= currentTrim.endMicros) {
      videoRef.current?.pause();
      stopPlayheadAnimation();
      handleSeek(currentTrim.endMicros);
      return;
    }
    setPlayheadMicros(clampToTrim(currentMicros, currentTrim));
  }

  function startPlayheadAnimation() {
    stopPlayheadAnimation();
    const update = () => {
      const video = videoRef.current;
      if (!video || video.paused) {
        animationFrameRef.current = null;
        return;
      }
      handleTimeUpdate(video.currentTime);
      if (!video.paused) {
        animationFrameRef.current = requestAnimationFrame(update);
      }
    };
    animationFrameRef.current = requestAnimationFrame(update);
  }

  function stopPlayheadAnimation() {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  return (
    <div className="editor-stage-content">
      <VideoPreview
        sourceId={sourceId}
        preview={preview}
        videoRef={videoRef}
        onPlaybackError={onPreviewPlaybackError}
        onLoadedMetadata={() => handleSeek(displayedPlayheadMicros)}
        onPlay={() => {
          const currentMicros = Math.round((videoRef.current?.currentTime ?? 0) * 1_000_000);
          if (currentMicros >= trim.endMicros || currentMicros < trim.startMicros) {
            handleSeek(trim.startMicros);
          }
          startPlayheadAnimation();
        }}
        onPause={stopPlayheadAnimation}
        onTimeUpdate={handleTimeUpdate}
      />
      <TrimTimeline
        range={trim}
        playheadMicros={displayedPlayheadMicros}
        frameRate={frameRate}
        onChange={onTrimChange}
        onSeek={handleSeek}
      />
    </div>
  );
}

function seekVideo(video: HTMLVideoElement | null, micros: number) {
  if (!video) {
    return;
  }
  try {
    video.currentTime = micros / 1_000_000;
  } catch {
    // Metadata may not be ready yet; loadedmetadata retries the seek.
  }
}
