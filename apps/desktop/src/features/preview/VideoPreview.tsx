import { useEffect, useRef, type RefObject } from "react";

import type { PreviewState } from "../../app/session-state";

interface VideoPreviewProps {
  sourceId: string;
  preview: PreviewState;
  videoRef: RefObject<HTMLVideoElement | null>;
  onPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onLoadedMetadata: () => void;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (seconds: number) => void;
}

export function VideoPreview({
  sourceId,
  preview,
  videoRef,
  onPlaybackError,
  onLoadedMetadata,
  onPlay,
  onPause,
  onTimeUpdate,
}: VideoPreviewProps) {
  const reportedUrl = useRef<string | null>(null);
  const readyUrl = preview.status === "ready" ? preview.value.url : null;

  useEffect(() => {
    reportedUrl.current = null;
  }, [readyUrl]);

  if (preview.status === "idle" || preview.status === "loading") {
    return (
      <div className="preview-status" role="status">
        <span className="preview-spinner" aria-hidden="true" />
        <strong>
          {preview.status === "loading" && preview.kind === "proxy"
            ? "Preparing compatible preview\u2026"
            : "Opening preview\u2026"}
        </strong>
        {preview.status === "loading" && preview.kind === "proxy" ? (
          <span>This can take a moment for high-resolution sources.</span>
        ) : null}
      </div>
    );
  }

  if (preview.status === "failed") {
    return (
      <div className="preview-error error-card" role="alert">
        <strong>Could not preview this video</strong>
        <p>{preview.error.message}</p>
        {preview.error.diagnostics ? (
          <details>
            <summary>Technical details</summary>
            <pre>{preview.error.diagnostics}</pre>
          </details>
        ) : null}
      </div>
    );
  }

  const { value } = preview;
  return (
    <div className="video-preview">
      <video
        ref={videoRef}
        key={value.url}
        className="preview-video"
        src={value.url}
        controls
        preload="metadata"
        aria-label="Source video preview"
        data-preview-kind={value.kind}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
        onError={() => {
          if (reportedUrl.current === value.url) {
            return;
          }
          reportedUrl.current = value.url;
          onPlaybackError(sourceId, value.kind);
        }}
      />
      {value.kind === "proxy" ? <span className="proxy-badge">720p preview</span> : null}
    </div>
  );
}
