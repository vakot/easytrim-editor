import {
  BetweenVerticalStart,
  Gauge,
  Magnet,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  SquareArrowLeft,
  SquareArrowRight,
} from "lucide-react";
import { useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPlaybackTime } from "@/domain/playback";
import {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_STEPS,
  type PlaybackSpeed,
} from "@/domain/playback-speed";
import type { TrimBoundary } from "@/domain/trim";
import type { FrameRate } from "@/lib/tauri/media";
import { useTranslation } from "react-i18next";

const PLAYBACK_SPEED_MARKERS = [0.5, 1, 1.5, 2, 3].map((speed) => ({
  value: PLAYBACK_SPEED_STEPS.indexOf(speed as PlaybackSpeed),
  label: `${speed}×`,
}));

interface PlaybackControlsProps {
  isPlaying: boolean;
  error: string | null;
  canSetSegmentStart: boolean;
  canSetSegmentEnd: boolean;
  disabled?: boolean;
  onTogglePlayback: () => void;
  onStepFrame: (direction: -1 | 1) => void;
  onSetSegmentBoundary: (boundary: TrimBoundary) => void;
}

export function PlaybackControls({
  isPlaying,
  error,
  canSetSegmentStart,
  canSetSegmentEnd,
  disabled = false,
  onTogglePlayback,
  onStepFrame,
  onSetSegmentBoundary,
}: PlaybackControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="relative flex items-center justify-center" aria-label={t("preview.controls")}>
      <div className="flex items-center gap-1.5">
        <TransportButton
          label={t("preview.setStart")}
          shortcut="I"
          title={
            canSetSegmentStart ? t("preview.setStartShortcut") : t("preview.setStartUnavailable")
          }
          disabled={disabled || !canSetSegmentStart}
          onClick={() => onSetSegmentBoundary("start")}
        >
          <SquareArrowRight />
        </TransportButton>
        <TransportButton
          label={t("preview.previousFrame")}
          shortcut="ArrowLeft"
          title={t("preview.previousFrameShortcut")}
          disabled={disabled}
          onClick={() => onStepFrame(-1)}
        >
          <SkipBack />
        </TransportButton>
        <TransportButton
          label={isPlaying ? t("preview.pause") : t("preview.play")}
          shortcut="Space"
          title={isPlaying ? t("preview.pauseShortcut") : t("preview.playShortcut")}
          primary
          disabled={disabled}
          onClick={onTogglePlayback}
        >
          {isPlaying ? <Pause /> : <Play />}
        </TransportButton>
        <TransportButton
          label={t("preview.nextFrame")}
          shortcut="ArrowRight"
          title={t("preview.nextFrameShortcut")}
          disabled={disabled}
          onClick={() => onStepFrame(1)}
        >
          <SkipForward />
        </TransportButton>
        <TransportButton
          label={t("preview.setEnd")}
          shortcut="O"
          title={canSetSegmentEnd ? t("preview.setEndShortcut") : t("preview.setEndUnavailable")}
          disabled={disabled || !canSetSegmentEnd}
          onClick={() => onSetSegmentBoundary("end")}
        >
          <SquareArrowLeft />
        </TransportButton>
      </div>
      {error ? (
        <Alert variant="destructive" className="absolute top-full z-10 mt-2 w-72">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function TransportButton({
  label,
  shortcut,
  title,
  primary = false,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  title: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={primary ? "default" : "ghost"}
          size={primary ? "icon-lg" : "icon-sm"}
          type="button"
          data-editor-shortcut="true"
          aria-label={label}
          aria-keyshortcuts={shortcut}
          disabled={disabled}
          onClick={onClick}
          className={primary ? "rounded-full" : undefined}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

interface PlaybackTimecodeProps {
  currentMicros: number | null;
  sourceDurationMicros: number | null;
  frameRate?: FrameRate;
}

export function PlaybackTimecode({
  currentMicros,
  sourceDurationMicros,
  frameRate,
}: PlaybackTimecodeProps) {
  const { t } = useTranslation();

  return (
    <output className="font-mono text-xs text-foreground" aria-label={t("preview.currentTime")}>
      {currentMicros === null ? "00:00:00:00f" : formatPlaybackTime(currentMicros, frameRate)}
      <span className="text-muted-foreground">
        {" "}
        /{" "}
        {sourceDurationMicros === null
          ? "00:00:00:00f"
          : formatPlaybackTime(sourceDurationMicros, frameRate)}
      </span>
    </output>
  );
}

export function TimelineTools() {
  return (
    <>
      <div className="grid grid-flow-col auto-cols-[1.75rem] grid-rows-[repeat(2,1.75rem)] gap-1">
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
              className="mt-2 min-w-0 flex-1 [&_[data-slot=slider-track]]:h-1.5"
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
}: {
  enabled: boolean;
  label: string;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <Tooltip
      open={tooltipOpen}
      onOpenChange={(open) => {
        if (open) setTooltipOpen(true);
      }}
    >
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon-sm"
          type="button"
          aria-label={label}
          aria-pressed={enabled}
          onClick={onClick}
          onPointerLeave={() => setTooltipOpen(false)}
          onBlur={() => setTooltipOpen(false)}
          className={enabled ? "text-primary" : undefined}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent onEscapeKeyDown={() => setTooltipOpen(false)}>{title}</TooltipContent>
    </Tooltip>
  );
}
