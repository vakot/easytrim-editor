import {
  BetweenHorizontalStart,
  Gauge,
  Link2,
  Pause,
  Play,
  Repeat2,
  SkipBack,
  SkipForward,
  SquareArrowLeft,
  SquareArrowRight,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPlaybackTime } from "@/domain/playback";
import type { TrimBoundary } from "@/domain/trim";
import type { FrameRate } from "@/lib/tauri/media";
import {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_STEPS,
  type PlaybackSpeed,
} from "../editor/hooks/usePlaybackSpeed";
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
  onTogglePlayback: () => void;
  onStepFrame: (direction: -1 | 1) => void;
  onSetSegmentBoundary: (boundary: TrimBoundary) => void;
}

export function PlaybackControls({
  isPlaying,
  error,
  canSetSegmentStart,
  canSetSegmentEnd,
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
          disabled={!canSetSegmentStart}
          onClick={() => onSetSegmentBoundary("start")}
        >
          <SquareArrowRight />
        </TransportButton>
        <TransportButton
          label={t("preview.previousFrame")}
          shortcut="ArrowLeft"
          title={t("preview.previousFrameShortcut")}
          onClick={() => onStepFrame(-1)}
        >
          <SkipBack />
        </TransportButton>
        <TransportButton
          label={isPlaying ? t("preview.pause") : t("preview.play")}
          shortcut="Space"
          title={isPlaying ? t("preview.pauseShortcut") : t("preview.playShortcut")}
          primary
          onClick={onTogglePlayback}
        >
          {isPlaying ? <Pause /> : <Play />}
        </TransportButton>
        <TransportButton
          label={t("preview.nextFrame")}
          shortcut="ArrowRight"
          title={t("preview.nextFrameShortcut")}
          onClick={() => onStepFrame(1)}
        >
          <SkipForward />
        </TransportButton>
        <TransportButton
          label={t("preview.setEnd")}
          shortcut="O"
          title={canSetSegmentEnd ? t("preview.setEndShortcut") : t("preview.setEndUnavailable")}
          disabled={!canSetSegmentEnd}
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
  currentMicros: number;
  sourceDurationMicros: number;
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
      {formatPlaybackTime(currentMicros, frameRate)}
      <span className="text-muted-foreground">
        {" "}
        / {formatPlaybackTime(sourceDurationMicros, frameRate)}
      </span>
    </output>
  );
}

interface TimelineToolsProps {
  safeTrimFollowingEnabled: boolean;
  loopPlaybackEnabled: boolean;
  segmentPlaybackEnabled: boolean;
  playbackSpeed: PlaybackSpeed;
  onToggleSafeTrimFollowing: () => void;
  onToggleLoopPlayback: () => void;
  onToggleSegmentPlayback: () => void;
  onPlaybackSpeedChange: (speed: PlaybackSpeed) => void;
}

export function TimelineTools({
  safeTrimFollowingEnabled,
  loopPlaybackEnabled,
  segmentPlaybackEnabled,
  playbackSpeed,
  onToggleSafeTrimFollowing,
  onToggleLoopPlayback,
  onToggleSegmentPlayback,
  onPlaybackSpeedChange,
}: TimelineToolsProps) {
  const { t } = useTranslation();

  return (
    <>
      <TimelineToolButton
        enabled={safeTrimFollowingEnabled}
        label={t("preview.safeTrim.label")}
        title={t(
          safeTrimFollowingEnabled ? "preview.safeTrim.enabled" : "preview.safeTrim.disabled",
        )}
        onClick={onToggleSafeTrimFollowing}
      >
        <Link2 />
      </TimelineToolButton>
      <TimelineToolButton
        enabled={loopPlaybackEnabled}
        label={t("preview.loopPlayback.label")}
        title={t(
          loopPlaybackEnabled ? "preview.loopPlayback.enabled" : "preview.loopPlayback.disabled",
        )}
        onClick={onToggleLoopPlayback}
      >
        <Repeat2 />
      </TimelineToolButton>
      <TimelineToolButton
        enabled={segmentPlaybackEnabled}
        label={t("preview.segmentPlayback.label")}
        title={t(
          segmentPlaybackEnabled
            ? "preview.segmentPlayback.enabled"
            : "preview.segmentPlayback.disabled",
        )}
        onClick={onToggleSegmentPlayback}
      >
        <BetweenHorizontalStart />
      </TimelineToolButton>
      <PlaybackSpeedTool speed={playbackSpeed} onChange={onPlaybackSpeedChange} />
    </>
  );
}

function PlaybackSpeedTool({
  speed,
  onChange,
}: {
  speed: PlaybackSpeed;
  onChange: (speed: PlaybackSpeed) => void;
}) {
  const { t } = useTranslation();
  const stepIndex = PLAYBACK_SPEED_STEPS.indexOf(speed);
  const enabled = speed !== DEFAULT_PLAYBACK_SPEED;

  return (
    <Tooltip>
      <Popover>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant={enabled ? "secondary" : "ghost"}
              size="icon-sm"
              type="button"
              aria-label={t("preview.playbackSpeed.label")}
              aria-pressed={enabled}
              className={enabled ? "text-primary" : undefined}
            >
              <Gauge />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("preview.playbackSpeed.tooltip")}</TooltipContent>
        <PopoverContent side="bottom" align="center" className="w-56 px-3 py-1">
          <div className="mt-3 flex w-full min-w-0 items-center gap-2">
            <Slider
              className="min-w-0 flex-1"
              min={0}
              max={PLAYBACK_SPEED_STEPS.length - 1}
              step={1}
              value={[stepIndex]}
              onValueChange={([index]) => {
                const nextSpeed = PLAYBACK_SPEED_STEPS[index ?? stepIndex];
                if (nextSpeed !== undefined) onChange(nextSpeed);
              }}
              onDoubleClick={() => onChange(DEFAULT_PLAYBACK_SPEED)}
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
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={enabled ? "secondary" : "ghost"}
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
