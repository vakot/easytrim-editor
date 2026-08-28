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
  preview: PreviewState;
  nativeLoopEnabled?: boolean;
  muted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onPlaybackError: (previewKind: "source" | "proxy") => void;
  onLoadedMetadata: () => void;
  onCanPlay: () => void;
  onTogglePlayback: () => void;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (seconds: number) => void;
  onEnded: () => void;
  onCropToolOpenChange?: (isOpen: boolean) => void;
}

export function VideoPreview({
  preview,
  nativeLoopEnabled = false,
  muted,
  videoRef,
  onPlaybackError,
  onLoadedMetadata,
  onCanPlay,
  onTogglePlayback,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onCropToolOpenChange,
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
    <section className="grid size-full min-h-0 place-items-center bg-preview-surface p-4">
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
          nativeLoopEnabled={nativeLoopEnabled}
          muted={muted}
          videoRef={videoRef}
          onTogglePlayback={onTogglePlayback}
          onLoadedMetadata={onLoadedMetadata}
          onCanPlay={onCanPlay}
          onPlay={onPlay}
          onPause={onPause}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          onError={() => {
            if (reportedUrl.current === value.url) return;
            reportedUrl.current = value.url;
            onPlaybackError(value.kind);
          }}
          onCropToolOpenChange={setCropToolOpen}
        />
        {value.kind === "proxy" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                role="status"
                tabIndex={0}
                className="absolute top-3 right-3 cursor-help"
              >
                {t("preview.proxyBadge")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent sideOffset={6} className="max-w-[18rem] whitespace-normal text-center">
              {t("preview.proxyBadgeDescription")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </section>
  );
}
