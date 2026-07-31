import { useEffect, useRef, useState } from "react";

import type { PreviewState } from "../../app/session-state";
import { clampPlaybackMicros, frameDurationMicros } from "../../domain/playback";
import type { TrimRange } from "../../domain/trim";
import type { FrameRate } from "../../lib/tauri/media";
import { PlaybackControls } from "../preview/PlaybackControls";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [transportError, setTransportError] = useState<string | null>(null);
  const displayedPlayheadMicros = clampPlaybackMicros(playheadMicros, trim.sourceDurationMicros);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  function handleSeek(micros: number) {
    const clamped = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
    setPlayheadMicros(clamped);
    seekVideo(videoRef.current, clamped);
  }

  function handleTimeUpdate(seconds: number) {
    const currentTrim = trimRef.current;
    const currentMicros = Math.round(seconds * 1_000_000);
    if (currentMicros >= currentTrim.sourceDurationMicros) {
      stopPlayheadAnimation();
      handleSeek(currentTrim.sourceDurationMicros);
      return;
    }
    setPlayheadMicros(clampPlaybackMicros(currentMicros, currentTrim.sourceDurationMicros));
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

  function handleTogglePlayback() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setTransportError(null);
    if (isPlaying) {
      video.pause();
      return;
    }
    if (displayedPlayheadMicros >= trimRef.current.sourceDurationMicros) {
      handleSeek(0);
    }
    void video.play().catch(() => {
      setIsPlaying(false);
      setTransportError("Playback could not start.");
    });
  }

  function handleStepFrame(direction: -1 | 1) {
    videoRef.current?.pause();
    setIsPlaying(false);
    stopPlayheadAnimation();
    handleSeek(displayedPlayheadMicros + direction * frameDurationMicros(frameRate));
  }

  return (
    <div className="editor-stage-content">
      <div className="preview-workspace">
        <VideoPreview
          sourceId={sourceId}
          preview={preview}
          videoRef={videoRef}
          onPlaybackError={onPreviewPlaybackError}
          onLoadedMetadata={() => handleSeek(displayedPlayheadMicros)}
          onTogglePlayback={handleTogglePlayback}
          onPlay={() => {
            setIsPlaying(true);
            startPlayheadAnimation();
          }}
          onPause={() => {
            setIsPlaying(false);
            stopPlayheadAnimation();
            const video = videoRef.current;
            if (video) {
              handleTimeUpdate(video.currentTime);
            }
          }}
          onTimeUpdate={handleTimeUpdate}
        />
        {preview.status === "ready" ? (
          <PlaybackControls
            isPlaying={isPlaying}
            currentMicros={displayedPlayheadMicros}
            sourceDurationMicros={trim.sourceDurationMicros}
            error={transportError}
            onTogglePlayback={handleTogglePlayback}
            onStepFrame={handleStepFrame}
          />
        ) : null}
      </div>
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
