import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import type { PreviewState } from "@/app/session-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { CropViewport } from "./CropViewport";
import type { CropRect } from "./utils/crop-geometry";
import { VideoPreviewEmpty } from "@/features/preview/VideoPreviewEmpty";

interface VideoPreviewProps {
  sourceId: string | null;
  preview: PreviewState;
  playbackRate: number;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onLoadedMetadata: () => void;
  onTogglePlayback: () => void;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (seconds: number) => void;
  onEnded: () => void;
  sourceDimensions?: { width: number; height: number };
  onCropResolutionChange?: (resolution: { width: number; height: number }) => void;
  onCropChange?: (crop: CropRect) => void;
  onCropToolOpenChange?: (isOpen: boolean) => void;
}

export function VideoPreview(props: VideoPreviewProps) {
  if (!props.sourceId) {
    return <VideoPreviewEmpty />;
  }

  return (
    <section className="grid size-full min-h-0 place-items-center bg-preview-surface p-4">
      <VideoPreviewContent {...props} />
    </section>
  );
}

function VideoPreviewContent({
  sourceId,
  preview,
  playbackRate,
  muted,
  videoRef,
  onPlaybackError,
  onLoadedMetadata,
  onTogglePlayback,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  sourceDimensions,
  onCropResolutionChange,
  onCropChange,
  onCropToolOpenChange,
}: VideoPreviewProps) {
  const { t } = useTranslation();
  const reportedUrl = useRef<string | null>(null);
  const [cropToolOpen, setCropToolOpen] = useState(false);
  const readyUrl = preview.status === "ready" ? preview.value.url : null;
  const effectiveSourceDimensions = sourceDimensions ?? { width: 1920, height: 1080 };
  const handleCropChange = useCallback(
    (crop: CropRect) => {
      onCropChange?.(crop);
      onCropResolutionChange?.({
        width: Math.max(1, Math.round(effectiveSourceDimensions.width * crop.width)),
        height: Math.max(1, Math.round(effectiveSourceDimensions.height * crop.height)),
      });
    },
    [
      effectiveSourceDimensions.height,
      effectiveSourceDimensions.width,
      onCropChange,
      onCropResolutionChange,
    ],
  );

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, readyUrl, videoRef]);

  useEffect(() => {
    reportedUrl.current = null;
  }, [readyUrl]);

  useEffect(() => {
    onCropToolOpenChange?.(cropToolOpen);
  }, [cropToolOpen, onCropToolOpenChange]);

  if (!sourceId) {
    return (
      <div
        className="size-full min-h-0 bg-preview-surface"
        aria-label={t("import.source.noSource")}
      />
    );
  }

  if (preview.status === "idle" || preview.status === "loading") {
    const isProxy = preview.status === "loading" && preview.kind === "proxy";
    return (
      <div
        className="grid place-items-center gap-2 text-center text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
        <strong className="text-foreground">
          {isProxy ? t("preview.preparing") : t("preview.opening")}
        </strong>
        {isProxy ? <span>{t("preview.preparingDescription")}</span> : null}
      </div>
    );
  }

  if (preview.status === "failed") {
    return (
      <Alert variant="destructive" className="max-w-xl">
        <AlertTitle>{t("preview.error")}</AlertTitle>
        <AlertDescription>
          <p>{preview.error.message}</p>
          {preview.error.diagnostics ? (
            <details className="mt-2">
              <summary>{t("import.source.technicalDetails")}</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">
                {preview.error.diagnostics}
              </pre>
            </details>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  const { value } = preview;
  return (
    <div
      className={`relative size-full min-h-0 bg-preview-surface ${
        cropToolOpen ? "overflow-visible" : "overflow-hidden"
      }`}
    >
      <CropViewport
        key={value.url}
        sourceUrl={value.url}
        previewKind={value.kind}
        sourceLabel={t("preview.sourceLabel")}
        playbackRate={playbackRate}
        muted={muted}
        videoRef={videoRef}
        onTogglePlayback={onTogglePlayback}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onError={() => {
          if (reportedUrl.current === value.url) return;
          reportedUrl.current = value.url;
          onPlaybackError(sourceId, value.kind);
        }}
        onCropToolOpenChange={setCropToolOpen}
        onCropChange={handleCropChange}
      />
      {value.kind === "proxy" ? (
        <Badge variant="secondary" className="absolute top-3 right-3">
          {t("preview.proxyBadge")}
        </Badge>
      ) : null}
    </div>
  );
}
