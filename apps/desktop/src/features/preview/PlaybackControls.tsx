import {
  BetweenHorizontalStart,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPlaybackTime } from "@/domain/playback";
import type { TrimBoundary } from "@/domain/trim";
import type { FrameRate } from "@/lib/tauri/media";
import { useTranslation } from "react-i18next";

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
  onToggleSafeTrimFollowing: () => void;
  onToggleLoopPlayback: () => void;
  onToggleSegmentPlayback: () => void;
}

export function TimelineTools({
  safeTrimFollowingEnabled,
  loopPlaybackEnabled,
  segmentPlaybackEnabled,
  onToggleSafeTrimFollowing,
  onToggleLoopPlayback,
  onToggleSegmentPlayback,
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
    </>
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
