import { BetweenVerticalStart, Clapperboard, Repeat, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

import type { useSceneDetection } from "../hooks/useSceneDetection";

import { StereoAudioMeter } from "./StereoAudioMeter";

function TimelineToolbar({
  sceneDetection,
}: {
  sceneDetection: ReturnType<typeof useSceneDetection>;
}) {
  const { t } = useTranslation();
  const { boundariesMicros, hasDetected, isDetecting } = sceneDetection;
  const status = isDetecting
    ? t("timeline.status.detectingScenes")
    : hasDetected
      ? boundariesMicros.length > 0
        ? t("timeline.status.sceneCount", { count: boundariesMicros.length })
        : t("timeline.status.noScenes")
      : null;

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
        <ResetToolsTool />
        <SceneDetectionTool sceneDetection={sceneDetection} />
      </div>
      {status && (
        <span
          aria-live="polite"
          className="max-w-36 self-center truncate text-xs text-muted-foreground"
          role="status"
          title={status}
        >
          {status}
        </span>
      )}

      <Separator orientation="vertical" />

      <StereoAudioMeter />
    </div>
  );
}

function SceneDetectionTool({
  sceneDetection,
}: {
  sceneDetection: ReturnType<typeof useSceneDetection>;
}) {
  const { t } = useTranslation();
  const { canDetect, detect, error, hasDetected, hasFailed, isDetecting } = sceneDetection;
  const button = (
    <Button
      aria-busy={isDetecting}
      aria-label={t("timeline.actions.detectScenes")}
      aria-pressed={hasDetected}
      className={hasDetected ? "text-primary" : undefined}
      disabled={!canDetect || isDetecting}
      onClick={hasFailed ? undefined : () => void detect()}
      size="icon-sm"
      type="button"
      variant={hasFailed ? "destructive" : "secondary"}
    >
      <Clapperboard />
    </Button>
  );

  if (hasFailed) {
    return (
      <Popover>
        <PopoverTrigger asChild>{button}</PopoverTrigger>
        <PopoverContent align="start" className="space-y-3">
          <p role="alert">{error || t("timeline.status.sceneDetectionFailed")}</p>
          <Button onClick={() => void detect()} size="sm" type="button">
            {t("common.actions.retry")}
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent>{t("timeline.tooltips.detectScenes")}</TooltipContent>
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
