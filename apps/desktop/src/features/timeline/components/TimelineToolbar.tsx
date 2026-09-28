import { BetweenVerticalStart, Clapperboard, Magnet, Repeat, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
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
  selectSnapPlaybackEnabled,
  snapPlaybackToggled,
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
  const { boundariesMicros, error, hasDetected, isDetecting } = sceneDetection;
  const status = error
    ? error
    : isDetecting
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
        <SnapPlaybackTool />
        <LoopPlaybackTool />
        <SegmentPlaybackTool />
        <ResetToolsTool />
        <SceneDetectionTool sceneDetection={sceneDetection} />
      </div>
      {status && (
        <span
          aria-live={error ? "assertive" : "polite"}
          className="max-w-36 self-center truncate text-xs text-muted-foreground"
          role={error ? "alert" : "status"}
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
  const { canDetect, detect, isDetecting } = sceneDetection;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-busy={isDetecting}
          aria-label={t("timeline.actions.detectScenes")}
          disabled={!canDetect || isDetecting}
          onClick={() => void detect()}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <Clapperboard />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("timeline.tooltips.detectScenes")}</TooltipContent>
    </Tooltip>
  );
}

function SnapPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectSnapPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.labels.snapPlayback")}
      onClick={() => dispatch(snapPlaybackToggled())}
      title={enabled ? t("preview.tooltips.snapEnabled") : t("preview.tooltips.snapDisabled")}
    >
      <Magnet />
    </TimelineToolButton>
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
