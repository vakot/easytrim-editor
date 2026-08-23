import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  type LucideIcon,
  MoveVertical,
  Video,
} from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { WebcamState } from "@/app/session-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TrimRange } from "@/domain/trim";
import { timelinePercent } from "@/domain/trim";
import type { WebcamPosition } from "@/lib/tauri/media";

import {
  isWebcamCorner,
  WEBCAM_CORNER_PRESETS,
  webcamPositionCorner,
  webcamPositionFor,
  webcamPositionIsOffset,
} from "./webcam-positions";
import type { WebcamCorner } from "./webcam-positions";

const WEBCAM_POSITION_ICONS = {
  topLeft: ArrowUpLeft,
  topRight: ArrowUpRight,
  bottomLeft: ArrowDownLeft,
  bottomRight: ArrowDownRight,
} as const satisfies Record<WebcamCorner, LucideIcon>;

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
  const offset = webcamPositionIsOffset(webcam.position);
  const selectedCornerPreset = WEBCAM_CORNER_PRESETS.find((preset) => preset.value === corner);
  const offsetActionLabel = t(offset ? "webcam.disableOffset" : "webcam.enableOffset");

  return (
    <section className="grid min-w-0 gap-2" aria-labelledby="timeline-webcam-title">
      <h3
        id="timeline-webcam-title"
        className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
      >
        {t("webcam.title")}
      </h3>
      <div className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 p-1 pr-2">
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
          <Select
            value={corner}
            disabled={!webcam.enabled || !webcam.media}
            onValueChange={(value) => {
              if (isWebcamCorner(value)) onPositionChange(webcamPositionFor(value, offset));
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("webcam.position")}
              className="min-w-0 w-full flex-1"
            >
              <SelectValue>
                {selectedCornerPreset ? t(selectedCornerPreset.labelKey) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {WEBCAM_CORNER_PRESETS.map((preset) => {
                const PositionIcon = WEBCAM_POSITION_ICONS[preset.value];
                return (
                  <SelectItem key={preset.value} value={preset.value}>
                    <PositionIcon
                      aria-hidden="true"
                      data-slot="webcam-position-icon"
                      data-position={preset.value}
                    />
                    {t(preset.labelKey)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <p
          className="truncate text-xs leading-5 text-muted-foreground"
          data-slot="webcam-source-details"
        >
          <span data-slot="webcam-source-title">{webcam.selection.displayName}</span>
          {" · "}
          <span data-slot="webcam-source-dimensions">{dimensions}</span>
        </p>
      </div>
      <div
        className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] items-end gap-3"
        aria-hidden="true"
      >
        <span
          className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase"
          data-slot="webcam-tools-title"
        >
          {t("timeline.tools")}
        </span>
        <span />
      </div>
      <div
        className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] items-center gap-3"
        data-slot="webcam-track-row"
      >
        <div
          className="grid grid-flow-col auto-cols-[1.75rem] grid-rows-[repeat(2,1.75rem)] gap-1"
          role="toolbar"
          aria-label={t("webcam.toolsLabel")}
          data-slot="webcam-tools"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                type="button"
                disabled={!webcam.enabled || !webcam.media}
                aria-label={offsetActionLabel}
                aria-pressed={offset}
                onClick={() => onPositionChange(webcamPositionFor(corner, !offset))}
                className={offset ? "text-primary" : undefined}
              >
                <MoveVertical data-slot="webcam-offset-icon" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{offsetActionLabel}</TooltipContent>
          </Tooltip>
        </div>
        <div
          className="relative flex h-12 min-w-0 items-center overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
          data-enabled={webcam.enabled}
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_25%,color-mix(in_oklab,var(--primary)_12%,transparent)_25%,color-mix(in_oklab,var(--primary)_12%,transparent)_50%,transparent_50%,transparent_75%,color-mix(in_oklab,var(--primary)_12%,transparent)_75%)] bg-[length:24px_24px]" />
          <div className="relative z-10 flex min-w-0 items-center gap-2 px-3">
            <Video className="size-4 text-primary" aria-hidden="true" />
            <p className="truncate text-xs text-muted-foreground" data-slot="webcam-track-status">
              {webcam.error ? webcam.error.message : t("webcam.syncedTrack")}
            </p>
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
