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
import { useState, type RefObject } from "react";
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
  const [controlsVisible, setControlsVisible] = useState(false);
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
      <div
        className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] gap-3"
        data-slot="webcam-track-row"
      >
        <Card
          className="relative flex flex-row items-center gap-2 bg-transparent p-1 pr-2 ring-transparent transition-[background-color,box-shadow] duration-150 data-[controls-visible=true]:bg-card data-[controls-visible=true]:ring-foreground/10"
          data-controls-visible={controlsVisible}
          onPointerEnter={() => setControlsVisible(true)}
          onPointerLeave={() => setControlsVisible(false)}
          onFocusCapture={() => setControlsVisible(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setControlsVisible(false);
          }}
        >
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
          <div className="relative min-w-0 flex-1">
            <div
              className="leading-tight opacity-100 transition-opacity duration-150 data-[controls-visible=true]:opacity-0"
              data-controls-visible={controlsVisible}
              data-slot="webcam-source-details"
              aria-hidden={controlsVisible}
            >
              <p
                className="truncate text-sm font-semibold transition-colors data-[enabled=false]:text-muted-foreground"
                data-enabled={webcam.enabled}
                data-slot="webcam-source-title"
              >
                {webcam.selection.displayName}
              </p>
              <p
                className="truncate text-xs leading-5 text-muted-foreground"
                data-slot="webcam-source-dimensions"
              >
                {dimensions}
              </p>
            </div>
            <div
              className="pointer-events-none absolute inset-0 flex items-center gap-1 opacity-0 transition-opacity duration-150 data-[controls-visible=true]:pointer-events-auto data-[controls-visible=true]:opacity-100"
              data-controls-visible={controlsVisible}
              data-slot="webcam-position-controls"
              aria-hidden={!controlsVisible}
              inert={!controlsVisible}
            >
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
          </div>
        </Card>
        <div
          className="relative flex h-12 min-w-0 items-center overflow-hidden rounded-lg border border-border bg-muted/30 transition-opacity data-[enabled=false]:opacity-40"
          data-enabled={webcam.enabled}
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_25%,color-mix(in_oklab,var(--primary)_12%,transparent)_25%,color-mix(in_oklab,var(--primary)_12%,transparent)_50%,transparent_50%,transparent_75%,color-mix(in_oklab,var(--primary)_12%,transparent)_75%)] bg-[length:24px_24px]" />
          <div className="relative z-10 flex min-w-0 items-center gap-2 px-3">
            <Video className="size-4 text-primary" aria-hidden="true" />
            <p className="truncate text-sm font-semibold" data-slot="webcam-track-status">
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
