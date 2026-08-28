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
      <div className="grid grid-flow-col auto-cols-7 grid-rows-[repeat(2,1.75rem)] gap-1">
        <SnapPlaybackTool />
        <LoopPlaybackTool />
        <SegmentPlaybackTool />
        <PlaybackSpeedTool />
      </div>
      <Separator
        orientation="vertical"
        className="mx-1"
        data-slot="timeline-tools-divider"
        aria-hidden="true"
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
      title={t(enabled ? "preview.snapPlayback.enabled" : "preview.snapPlayback.disabled")}
      onClick={() => dispatch(snapPlaybackToggled())}
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
      title={t(enabled ? "preview.loopPlayback.enabled" : "preview.loopPlayback.disabled")}
      onClick={() => dispatch(loopPlaybackToggled())}
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
      title={t(enabled ? "preview.segmentPlayback.enabled" : "preview.segmentPlayback.disabled")}
      onClick={() => dispatch(segmentPlaybackToggled())}
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
              variant="secondary"
              size="icon-sm"
              type="button"
              aria-label={t("preview.playbackSpeed.label")}
              aria-pressed={enabled}
              className={enabled ? "text-primary aria-expanded:text-primary" : undefined}
            >
              <Gauge />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("preview.playbackSpeed.tooltip")}</TooltipContent>
        <PopoverContent side="bottom" align="center" className="w-56 p-2.5">
          <div className="flex items-center gap-2">
            <Slider
              className="mt-2 min-w-0 flex-1 **:data-[slot=slider-track]:h-1.5"
              min={0}
              max={PLAYBACK_SPEED_STEPS.length - 1}
              step={1}
              value={[stepIndex]}
              onValueChange={([index]) => {
                const nextSpeed = PLAYBACK_SPEED_STEPS[index ?? stepIndex];
                if (nextSpeed !== undefined) dispatch(playbackSpeedChanged(nextSpeed));
              }}
              onDoubleClick={() => dispatch(playbackSpeedChanged(DEFAULT_PLAYBACK_SPEED))}
              aria-label={t("preview.playbackSpeed.label")}
              markers={PLAYBACK_SPEED_MARKERS}
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
      title={t("preview.resetTools")}
      onClick={() => dispatch(editorToolsReset(createEditorToolsStateFromPreferences(preferences)))}
      preserveOnTrigger={false}
    >
      <RotateCcw />
    </TimelineToolButton>
  );
}

function TimelineToolButton({
  enabled,
  label,
  title,
  onClick,
  children,
  preserveOnTrigger = true,
}: {
  enabled: boolean;
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  preserveOnTrigger?: boolean;
}) {
  return (
    <Tooltip preserveOnTrigger={preserveOnTrigger}>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon-sm"
          type="button"
          aria-label={label}
          aria-pressed={enabled}
          onClick={onClick}
          className={enabled ? "text-primary" : undefined}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
