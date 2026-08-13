import { Expand, Eye, EyeOff, Shrink, Video } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { WebcamState } from "@/app/session-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WebcamPosition } from "@/lib/tauri/media";
import type { TrimRange } from "@/domain/trim";
import { timelinePercent } from "@/domain/trim";

import {
  isWebcamCorner,
  WEBCAM_CORNER_PRESETS,
  webcamPositionCorner,
  webcamPositionFor,
  webcamPositionIsInset,
} from "./webcam-positions";

interface WebcamTrackProps {
  webcam: WebcamState;
  onToggle: () => void;
  onPositionChange: (position: WebcamPosition) => void;
  range: TrimRange;
  playheadMicros: number;
  playheadRef: RefObject<HTMLDivElement | null>;
}

export function WebcamTrack({
  webcam,
  onToggle,
  onPositionChange,
  range,
  playheadMicros,
  playheadRef,
}: WebcamTrackProps) {
  const { t } = useTranslation();
  const dimensions = webcam.media
    ? `${webcam.media.video.width} × ${webcam.media.video.height}`
    : t("webcam.inspecting");

  const corner = webcamPositionCorner(webcam.position);
  const inset = webcamPositionIsInset(webcam.position);
  const insetActionLabel = t(inset ? "webcam.disableInset" : "webcam.enableInset");

  return (
    <section className="grid min-w-0 gap-2" aria-labelledby="timeline-webcam-title">
      <h3
        id="timeline-webcam-title"
        className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
      >
        {t("webcam.title")}
      </h3>
      <div
        className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] gap-3"
        data-slot="webcam-track-row"
      >
        <Card className="flex flex-row items-center justify-between bg-transparent p-1 pr-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={t(webcam.enabled ? "webcam.hide" : "webcam.show")}
                aria-pressed={webcam.enabled}
                onClick={onToggle}
                className="text-primary"
              >
                {webcam.enabled ? <Eye /> : <EyeOff />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(webcam.enabled ? "webcam.hide" : "webcam.show")}</TooltipContent>
          </Tooltip>
          <div className="flex shrink-0 items-center gap-1">
            <Select
              value={corner}
              disabled={!webcam.enabled || !webcam.media}
              onValueChange={(value) => {
                if (isWebcamCorner(value)) onPositionChange(webcamPositionFor(value, inset));
              }}
            >
              <SelectTrigger size="sm" aria-label={t("webcam.position")} className="max-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEBCAM_CORNER_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {t(preset.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  disabled={!webcam.enabled || !webcam.media}
                  aria-label={insetActionLabel}
                  aria-pressed={inset}
                  onClick={() => onPositionChange(webcamPositionFor(corner, !inset))}
                  className="text-primary"
                >
                  {inset ? <Shrink /> : <Expand />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{insetActionLabel}</TooltipContent>
            </Tooltip>
          </div>
        </Card>
        <div
          className="relative flex h-12 min-w-0 items-center overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
          data-enabled={webcam.enabled}
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_25%,color-mix(in_oklab,var(--primary)_12%,transparent)_25%,color-mix(in_oklab,var(--primary)_12%,transparent)_50%,transparent_50%,transparent_75%,color-mix(in_oklab,var(--primary)_12%,transparent)_75%)] bg-[length:24px_24px]" />
          <div className="relative z-10 flex min-w-0 items-center gap-2 px-3">
            <Video className="size-4 text-primary" aria-hidden="true" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold" data-slot="webcam-track-primary">
                {webcam.selection.displayName}
              </p>
              <p
                className="truncate text-xs leading-5 text-muted-foreground"
                data-slot="webcam-track-secondary"
              >
                {dimensions} · {webcam.error ? webcam.error.message : t("webcam.syncedTrack")}
              </p>
            </div>
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 border-x border-primary/70 bg-primary/5"
            aria-hidden="true"
            style={{
              left: "var(--timeline-trim-start)",
              right: "var(--timeline-trim-end-inset)",
            }}
          />
          <div
            ref={playheadRef}
            className="webcam-playhead pointer-events-none absolute inset-y-0 border-l border-dashed border-foreground/70"
            data-slot="webcam-playhead"
            aria-hidden="true"
            style={{ left: `${timelinePercent(playheadMicros, range.sourceDurationMicros)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
