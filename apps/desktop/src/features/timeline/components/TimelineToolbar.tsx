import { BetweenVerticalStart, Clapperboard, Repeat } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  loopPlaybackToggled,
  segmentPlaybackToggled,
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { cn } from "@/lib/class-names.utils";

import { useSceneDetection } from "../hooks/useSceneDetection";

import { StereoAudioMeter } from "./StereoAudioMeter";

function TimelineToolbar() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("timeline.playhead.accessibility.tools")}
      className="flex w-full items-stretch gap-1"
      data-slot="timeline-toolbar"
      role="toolbar"
    >
      <div className="grid auto-cols-max grid-flow-col grid-rows-[repeat(2,1.75rem)] gap-1">
        <LoopPlaybackTool />
        <SegmentPlaybackTool />
        <SceneDetectionTool />
      </div>

      <Card className="w-full gap-0 rounded-md p-0 ring-inset">
        <CardContent className="flex h-full flex-col p-1">
          <StereoAudioMeter />
        </CardContent>
      </Card>
    </div>
  );
}

function SceneDetectionTool() {
  const { t } = useTranslation();
  const sourceReady = useAppSelector(selectSourceReady);
  const detectScenesCommand = useApplicationCommand("detect-scenes");
  const showSceneMarkersCommand = useApplicationCommand("show-scene-markers");
  const { executeCommand } = useApplicationCommands();
  const sceneDetection = useSceneDetection(sourceReady);
  const { error, hasDetected, hasFailed, isDetecting } = sceneDetection;
  const sceneMarkersEnabled = showSceneMarkersCommand.checked ?? true;
  const loading = detectScenesCommand.pending || isDetecting;
  const canRunAction = hasDetected ? showSceneMarkersCommand.enabled : detectScenesCommand.enabled;

  const actionLabel = hasDetected
    ? sceneMarkersEnabled
      ? t("timeline.sceneMarkers.actions.disableSceneMarkers")
      : t("timeline.sceneMarkers.actions.enableSceneMarkers")
    : t("timeline.sceneMarkers.actions.findSceneChanges");

  const label =
    loading && !hasDetected ? t("timeline.sceneMarkers.actions.findingSceneChanges") : actionLabel;

  const button = (
    <Button
      aria-busy={loading}
      aria-label={label}
      aria-pressed={hasDetected && sceneMarkersEnabled}
      className={cn(hasDetected && sceneMarkersEnabled && "text-primary")}
      disabled={!canRunAction || loading}
      onClick={
        hasFailed
          ? undefined
          : hasDetected
            ? () => void executeCommand("show-scene-markers", "button")
            : () => void executeCommand("detect-scenes", "button")
      }
      size="icon-sm"
      type="button"
      variant={hasFailed ? "destructive" : "secondary"}
    >
      {loading ? <Spinner aria-hidden="true" /> : <Clapperboard />}
    </Button>
  );

  if (hasFailed) {
    return (
      <Popover>
        <PopoverTrigger asChild>{button}</PopoverTrigger>
        <PopoverContent align="start" className="space-y-3">
          <p role="alert">{error || t("timeline.sceneMarkers.status.sceneDetectionFailed")}</p>
          <Button
            disabled={loading}
            onClick={() => void executeCommand("detect-scenes", "button")}
            size="sm"
            type="button"
          >
            {t("common.actions.retry")}
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip preserveOnTrigger>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        {hasDetected
          ? label
          : loading
            ? label
            : t("timeline.sceneMarkers.tooltips.findSceneChanges")}
      </TooltipContent>
    </Tooltip>
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
      onClick={() => dispatch(loopPlaybackToggled())}
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
      onClick={() => dispatch(segmentPlaybackToggled())}
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

function TimelineToolButton({
  children,
  enabled,
  label,
  onClick,
  preserveOnTrigger = true,
  title,
}: {
  children: React.ReactNode;
  enabled: boolean;
  label: string;
  onClick: () => void;
  preserveOnTrigger?: boolean;
  title: string;
}) {
  return (
    <Tooltip preserveOnTrigger={preserveOnTrigger}>
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
