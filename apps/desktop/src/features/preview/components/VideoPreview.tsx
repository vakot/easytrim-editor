import { LoaderCircle } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPlaybackSpeed } from "@/app/store/slices/editor-tools-slice";
import type { PreviewState } from "@/app/store/slices/preview-slice";

import { CropViewport } from "./CropViewport";

interface VideoPreviewProps {
  muted: boolean;
  nativeLoopEnabled?: boolean;
  onCanPlay: () => void;
  onCropToolOpenChange?: (isOpen: boolean) => void;
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPlay: () => void;
  onPlaybackError: (previewKind: "source" | "proxy") => void;
  onTimeUpdate: (seconds: number) => void;
  onTogglePlayback: () => void;
  preview: PreviewState;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function VideoPreview({
  muted,
  nativeLoopEnabled = false,
  onCanPlay,
  onCropToolOpenChange,
  onEnded,
  onLoadedMetadata,
  onPause,
  onPlay,
  onPlaybackError,
  onTimeUpdate,
  onTogglePlayback,
  preview,
  videoRef,
}: VideoPreviewProps) {
  const { t } = useTranslation();
  const playbackRate = useAppSelector(selectPlaybackSpeed);
  const reportedUrl = useRef<string | null>(null);
  const [cropToolOpen, setCropToolOpen] = useState(false);
  const readyUrl = preview.status === "ready" ? preview.value.url : null;
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, readyUrl, videoRef]);

  useEffect(() => {
    reportedUrl.current = null;
  }, [readyUrl]);

  useEffect(() => {
    onCropToolOpenChange?.(cropToolOpen);
  }, [cropToolOpen, onCropToolOpenChange]);

  if (preview.status === "idle" || preview.status === "loading") {
    const isProxy = preview.status === "loading" && preview.kind === "proxy";
    return (
      <div
        className="grid place-items-center gap-2 text-center text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary" />
        <strong className="text-foreground">
          {isProxy ? t("preview.preparing") : t("preview.opening")}
        </strong>
        {isProxy ? <span>{t("preview.preparingDescription")}</span> : null}
      </div>
    );
  }

  if (preview.status === "failed") {
    return (
      <Alert className="max-w-xl" variant="destructive">
        <AlertTitle>{t("preview.error")}</AlertTitle>
        <AlertDescription>
          <p>{preview.error.message}</p>
          {preview.error.diagnostics ? (
            <details className="mt-2">
              <summary>{t("import.source.technicalDetails")}</summary>
              <pre className="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap">
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
    <section className="grid size-full min-h-0 place-items-center bg-preview-surface p-4">
      <div
        className={`relative size-full min-h-0 bg-preview-surface ${
          cropToolOpen ? "overflow-visible" : "overflow-hidden"
        }`}
      >
        <CropViewport
          key={value.url}
          muted={muted}
          nativeLoopEnabled={nativeLoopEnabled}
          onCanPlay={onCanPlay}
          onCropToolOpenChange={setCropToolOpen}
          onEnded={onEnded}
          onError={() => {
            if (reportedUrl.current === value.url) return;
            reportedUrl.current = value.url;
            onPlaybackError(value.kind);
          }}
          onLoadedMetadata={onLoadedMetadata}
          onPause={onPause}
          onPlay={onPlay}
          onTimeUpdate={onTimeUpdate}
          onTogglePlayback={onTogglePlayback}
          playbackRate={playbackRate}
          previewKind={value.kind}
          sourceLabel={t("preview.sourceLabel")}
          sourceUrl={value.url}
          videoRef={videoRef}
        />
        {value.kind === "proxy" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className="absolute top-3 right-3 cursor-help"
                role="status"
                tabIndex={0}
                variant="secondary"
              >
                {t("preview.proxyBadge")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-2xs text-center whitespace-normal" sideOffset={6}>
              {t("preview.proxyBadgeDescription")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </section>
  );
}
