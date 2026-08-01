import {
  Link2,
  Pause,
  Play,
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
  return (
    <div
      className="relative flex items-center justify-center"
      aria-label="Preview playback controls"
    >
      <div className="flex items-center gap-1.5">
        <TransportButton
          label="Set segment start to current position"
          shortcut="I"
          title={
            canSetSegmentStart
              ? "Set segment start to current position (I)"
              : "Move before the source end to set segment start"
          }
          disabled={!canSetSegmentStart}
          onClick={() => onSetSegmentBoundary("start")}
        >
          <SquareArrowRight />
        </TransportButton>
        <TransportButton
          label="Previous frame"
          shortcut="ArrowLeft"
          title="Previous frame (Left Arrow)"
          onClick={() => onStepFrame(-1)}
        >
          <SkipBack />
        </TransportButton>
        <TransportButton
          label={isPlaying ? "Pause" : "Play"}
          shortcut="Space"
          title={`${isPlaying ? "Pause" : "Play"} (Space)`}
          primary
          onClick={onTogglePlayback}
        >
          {isPlaying ? <Pause /> : <Play />}
        </TransportButton>
        <TransportButton
          label="Next frame"
          shortcut="ArrowRight"
          title="Next frame (Right Arrow)"
          onClick={() => onStepFrame(1)}
        >
          <SkipForward />
        </TransportButton>
        <TransportButton
          label="Set segment end to current position"
          shortcut="O"
          title={
            canSetSegmentEnd
              ? "Set segment end to current position (O)"
              : "Move after the source start to set segment end"
          }
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
  return (
    <output className="font-mono text-xs text-foreground" aria-label="Current playback time">
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
  onToggleSafeTrimFollowing: () => void;
}

export function TimelineTools({
  safeTrimFollowingEnabled,
  onToggleSafeTrimFollowing,
}: TimelineToolsProps) {
  const title = safeTrimFollowingEnabled
    ? "Safe trim following: on — playhead follows a trim border once caught"
    : "Safe trim following: off — playhead stays in place";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={safeTrimFollowingEnabled ? "secondary" : "ghost"}
          size="icon-sm"
          type="button"
          aria-label="Safe trim following"
          aria-pressed={safeTrimFollowingEnabled}
          onClick={onToggleSafeTrimFollowing}
          className={safeTrimFollowingEnabled ? "text-primary" : undefined}
        >
          <Link2 />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
