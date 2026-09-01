import { AlertCircle } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPlaybackSpeed } from "@/app/store/slices/editor-tools-slice";
import type { PreviewState } from "@/app/store/slices/preview-slice";
import { cn } from "@/lib/class-names.utils";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

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
  onSkip: () => void;
  onTimeUpdate: (seconds: number) => void;
  onTogglePlayback: (origin?: DiagnosticOrigin) => void;
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
  onSkip,
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
    return <div aria-hidden="true" className="size-full bg-preview-surface" />;
  }

  if (preview.status === "failed") {
    return (
      <div className="flex h-full items-center justify-center">
        <Alert className="max-w-md" variant="destructive">
          <AlertCircle />
          <AlertTitle>{t("preview.messages.error")}</AlertTitle>
          <AlertDescription>
            <p>{preview.error.message}</p>
            {preview.error.diagnostics ? (
              <details className="mt-2">
                <summary>{t("source.labels.technicalDetails")}</summary>
                <pre className="mt-2 max-h-48 overflow-auto text-xs whitespace-pre-wrap">
                  {preview.error.diagnostics}
                </pre>
              </details>
            ) : null}
          </AlertDescription>
          <AlertAction>
            <Button className="mt-3" onClick={onSkip} size="sm" variant="outline">
              {t("queue.actions.skip")}
            </Button>
          </AlertAction>
        </Alert>
      </div>
    );
  }

  const { value } = preview;

  return (
    <section className="grid size-full min-h-0 place-items-center">
      <div
        className={cn(
          "relative size-full min-h-0 bg-preview-surface",
          cropToolOpen ? "overflow-visible" : "overflow-hidden",
        )}
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
          sourceLabel={t("preview.accessibility.source")}
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
                {t("preview.labels.compatible")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-2xs text-center whitespace-normal" sideOffset={6}>
              {t("preview.messages.proxy")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </section>
  );
}
