import { BetweenVerticalStart, Clapperboard, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/preferences-slice";
import {
  sceneMarkersToggled,
  selectSceneDetectionStatus,
  selectSceneMarkersVisible,
} from "@/app/store/slices/scene-detection-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { detectActiveSourceScenes } from "@/app/store/thunks/scene-detection-thunks";
import { localizeAppError } from "@/i18n/app-errors";
import { cn } from "@/lib/class-names.utils";

import { StereoAudioMeter } from "./StereoAudioMeter";

function TimelineToolbar() {
  return (
    <div
      aria-labelledby="timeline-tools-title"
      className="flex h-15 items-stretch gap-1"
      data-slot="timeline-toolbar"
      role="group"
    >
      <LoopPlaybackTool />
      <SegmentPlaybackTool />
      <SceneDetectionTool />

      <Card className="min-w-0 flex-1 gap-0 rounded-md border border-border bg-muted p-0 ring-0">
        <CardContent className="flex h-full flex-col p-1">
          <StereoAudioMeter />
        </CardContent>
      </Card>
    </div>
  );
}

function LoopPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectLoopPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.playback.loopPlayback")}
      onClick={() => dispatch(preferenceChanged({ key: "loopPlaybackEnabled", enabled: !enabled }))}
      title={
        enabled
          ? t("preview.playback.loopEnabledTooltip")
          : t("preview.playback.loopDisabledTooltip")
      }
    >
      <Repeat />
    </TimelineToolButton>
  );
}

function SegmentPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectSegmentPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.playback.segmentPlayback")}
      onClick={() =>
        dispatch(preferenceChanged({ key: "segmentPlaybackEnabled", enabled: !enabled }))
      }
      title={
        enabled
          ? t("preview.segment.segmentEnabledTooltip")
          : t("preview.segment.segmentDisabledTooltip")
      }
    >
      <BetweenVerticalStart />
    </TimelineToolButton>
  );
}

function SceneDetectionTool() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceReady = useAppSelector(selectSourceReady);
  const detection = useAppSelector(selectSceneDetectionStatus);
  const markersVisible = useAppSelector(selectSceneMarkersVisible);
  const detect = () => void dispatch(detectActiveSourceScenes());

  if (detection.status === "failed") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-label={t("timeline.sceneMarkers.status.sceneDetectionFailed")}
            size="icon-sm"
            type="button"
            variant="destructive"
          >
            <Clapperboard />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="space-y-3">
          <p role="alert">
            {detection.error
              ? localizeAppError(detection.error, t)
              : t("timeline.sceneMarkers.status.sceneDetectionFailed")}
          </p>
          <Button onClick={detect} size="sm" type="button">
            {t("common.actions.retry")}
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  const ready = detection.status === "ready";
  const loading = detection.status === "loading";
  const label = ready
    ? markersVisible
      ? t("timeline.sceneMarkers.actions.disableSceneMarkers")
      : t("timeline.sceneMarkers.actions.enableSceneMarkers")
    : loading
      ? t("timeline.sceneMarkers.actions.findingSceneChanges")
      : t("timeline.sceneMarkers.actions.findSceneChanges");

  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>
        <Button
          aria-busy={loading}
          aria-label={label}
          aria-pressed={ready && markersVisible}
          className={cn(ready && markersVisible && "text-primary")}
          disabled={!sourceReady || loading || detection.status === "unavailable"}
          onClick={ready ? () => dispatch(sceneMarkersToggled()) : detect}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          {loading ? <Spinner aria-hidden="true" /> : <Clapperboard />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {ready || loading ? label : t("timeline.sceneMarkers.tooltips.findSceneChanges")}
      </TooltipContent>
    </Tooltip>
  );
}

function TimelineToolButton({
  children,
  enabled,
  label,
  onClick,
  title,
}: {
  children: React.ReactNode;
  enabled: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={enabled}
          className={cn(enabled && "text-primary")}
          onClick={onClick}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

export { TimelineToolbar };
