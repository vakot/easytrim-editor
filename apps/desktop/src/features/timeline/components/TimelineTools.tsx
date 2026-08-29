import { BetweenVerticalStart, Gauge, Magnet, Repeat, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  createEditorToolsStateFromPreferences,
  editorToolsReset,
  loopPlaybackToggled,
  playbackSpeedChanged,
  segmentPlaybackToggled,
  selectLoopPlaybackEnabled,
  selectPlaybackSpeed,
  selectSegmentPlaybackEnabled,
  selectSnapPlaybackEnabled,
  snapPlaybackToggled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPreferences } from "@/app/store/slices/preferences-slice";
import {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_STEPS,
  type PlaybackSpeed,
} from "@/domain/playback-speed";

const PLAYBACK_SPEED_MARKERS = [0.5, 1, 1.5, 2, 3].map((speed) => ({
  value: PLAYBACK_SPEED_STEPS.indexOf(speed as PlaybackSpeed),
  label: `${speed}×`,
}));

export function TimelineTools() {
  return (
    <>
      <div className="grid auto-cols-7 grid-flow-col grid-rows-[repeat(2,1.75rem)] gap-1">
        <SnapPlaybackTool />
        <LoopPlaybackTool />
        <SegmentPlaybackTool />
        <PlaybackSpeedTool />
      </div>
      <Separator
        aria-hidden="true"
        className="mx-1"
        data-slot="timeline-tools-divider"
        orientation="vertical"
      />
      <div className="shrink-0 self-start">
        <ResetToolsTool />
      </div>
    </>
  );
}

function SnapPlaybackTool() {
  const { t } = useTranslation();
  const enabled = useAppSelector(selectSnapPlaybackEnabled);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={enabled}
      label={t("preview.snapPlayback.label")}
      onClick={() => dispatch(snapPlaybackToggled())}
      title={t(enabled ? "preview.snapPlayback.enabled" : "preview.snapPlayback.disabled")}
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
      label={t("preview.loopPlayback.label")}
      onClick={() => dispatch(loopPlaybackToggled())}
      title={t(enabled ? "preview.loopPlayback.enabled" : "preview.loopPlayback.disabled")}
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
      label={t("preview.segmentPlayback.label")}
      onClick={() => dispatch(segmentPlaybackToggled())}
      title={t(enabled ? "preview.segmentPlayback.enabled" : "preview.segmentPlayback.disabled")}
    >
      <BetweenVerticalStart />
    </TimelineToolButton>
  );
}

function PlaybackSpeedTool() {
  const { t } = useTranslation();
  const speed = useAppSelector(selectPlaybackSpeed);
  const dispatch = useAppDispatch();
  const stepIndex = PLAYBACK_SPEED_STEPS.indexOf(speed);
  const enabled = speed !== DEFAULT_PLAYBACK_SPEED;

  return (
    <Tooltip>
      <Popover>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              aria-label={t("preview.playbackSpeed.label")}
              aria-pressed={enabled}
              className={enabled ? "text-primary aria-expanded:text-primary" : undefined}
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <Gauge />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("preview.playbackSpeed.tooltip")}</TooltipContent>
        <PopoverContent align="center" className="w-56 p-2.5" side="bottom">
          <div className="flex items-center gap-2">
            <Slider
              aria-label={t("preview.playbackSpeed.label")}
              className="mt-2 min-w-0 flex-1 **:data-[slot=slider-track]:h-1.5"
              markers={PLAYBACK_SPEED_MARKERS}
              max={PLAYBACK_SPEED_STEPS.length - 1}
              min={0}
              onDoubleClick={() => dispatch(playbackSpeedChanged(DEFAULT_PLAYBACK_SPEED))}
              onValueChange={([index]) => {
                const nextSpeed = PLAYBACK_SPEED_STEPS[index ?? stepIndex];
                if (nextSpeed !== undefined) dispatch(playbackSpeedChanged(nextSpeed));
              }}
              step={1}
              value={[stepIndex]}
            />
            <output className="w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {speed.toFixed(2)}×
            </output>
          </div>
        </PopoverContent>
      </Popover>
    </Tooltip>
  );
}

function ResetToolsTool() {
  const { t } = useTranslation();
  const preferences = useAppSelector(selectPreferences);
  const dispatch = useAppDispatch();

  return (
    <TimelineToolButton
      enabled={false}
      label={t("preview.resetTools")}
      onClick={() => dispatch(editorToolsReset(createEditorToolsStateFromPreferences(preferences)))}
      preserveOnTrigger={false}
      title={t("preview.resetTools")}
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
