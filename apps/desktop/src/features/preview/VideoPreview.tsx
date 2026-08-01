import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";

import type { PreviewState } from "@/app/session-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface VideoPreviewProps {
  sourceId: string;
  preview: PreviewState;
  videoRef: RefObject<HTMLVideoElement | null>;
  onPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onLoadedMetadata: () => void;
  onTogglePlayback: () => void;
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
  onTogglePlayback,
  onPlay,
  onPause,
  onTimeUpdate,
}: VideoPreviewProps) {
  const { t } = useTranslation();
  const reportedUrl = useRef<string | null>(null);
  const readyUrl = preview.status === "ready" ? preview.value.url : null;

  useEffect(() => {
    reportedUrl.current = null;
  }, [readyUrl]);

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
    <div className="relative flex size-full min-h-0 items-center justify-center overflow-hidden bg-preview-surface">
      <video
        ref={videoRef}
        key={value.url}
        className="block size-full cursor-pointer object-contain"
        src={value.url}
        preload="metadata"
        aria-label={t("preview.sourceLabel")}
        data-preview-kind={value.kind}
        onClick={onTogglePlayback}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
        onError={() => {
          if (reportedUrl.current === value.url) return;
          reportedUrl.current = value.url;
          onPlaybackError(sourceId, value.kind);
        }}
      />
      {value.kind === "proxy" ? (
        <Badge variant="secondary" className="absolute top-3 right-3">
          {t("preview.proxyBadge")}
        </Badge>
      ) : null}
    </div>
  );
}
