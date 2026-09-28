import { BetweenVerticalStart, Clapperboard, LoaderCircle, Repeat, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useApplicationCommand, useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  createEditorToolsStateFromPreferences,
  editorToolsReset,
  loopPlaybackToggled,
  segmentPlaybackToggled,
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPreferences } from "@/app/store/slices/preferences-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";

import { useSceneDetection } from "../hooks/useSceneDetection";

import { StereoAudioMeter } from "./StereoAudioMeter";

function TimelineToolbar() {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("timeline.accessibility.tools")}
      className="flex w-full items-stretch gap-1"
      data-slot="timeline-toolbar"
      role="toolbar"
    >
      <div className="grid auto-cols-7 grid-flow-col grid-rows-[repeat(2,1.75rem)] gap-1">
        <LoopPlaybackTool />
        <SegmentPlaybackTool />
        <SceneDetectionTool />
        <ResetToolsTool />
      </div>

      <Separator orientation="vertical" />

      <StereoAudioMeter />
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
  const canRunAction = hasDetected
    ? showSceneMarkersCommand.enabled
    : detectScenesCommand.enabled;

  const label = hasDetected
    ? sceneMarkersEnabled
      ? t("timeline.actions.disableSceneMarkers")
      : t("timeline.actions.enableSceneMarkers")
    : t("timeline.actions.detectScenes");

  const button = (
    <Button
      aria-busy={loading}
      aria-label={label}
      aria-pressed={hasDetected && sceneMarkersEnabled}
      className={hasDetected && sceneMarkersEnabled ? "text-primary" : undefined}
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
      {loading ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
      ) : (
        <Clapperboard />
      )}
    </Button>
  );

  if (hasFailed) {
    return (
      <Popover>
        <PopoverTrigger asChild>{button}</PopoverTrigger>
        <PopoverContent align="start" className="space-y-3">
          <p role="alert">{error || t("timeline.status.sceneDetectionFailed")}</p>
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
      <TooltipContent>{hasDetected ? label : t("timeline.tooltips.detectScenes")}</TooltipContent>
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
      label={t("preview.labels.loopPlayback")}
      onClick={() => dispatch(loopPlaybackToggled())}
      title={enabled ? t("preview.tooltips.loopEnabled") : t("preview.tooltips.loopDisabled")}
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
      label={t("preview.labels.segmentPlayback")}
      onClick={() => dispatch(segmentPlaybackToggled())}
      title={enabled ? t("preview.tooltips.segmentEnabled") : t("preview.tooltips.segmentDisabled")}
    >
      <BetweenVerticalStart />
    </TimelineToolButton>
  );
}

function ResetToolsTool() {
  const { t } = useTranslation();
  const preferences = useAppSelector(selectPreferences);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={false}
      label={t("preview.actions.resetTools")}
      onClick={() => dispatch(editorToolsReset(createEditorToolsStateFromPreferences(preferences)))}
      preserveOnTrigger={false}
      title={t("preview.actions.resetTools")}
    >
      <RotateCcw />
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
          className={enabled ? "text-primary" : undefined}
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
