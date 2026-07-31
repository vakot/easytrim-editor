import type { TrimBoundary } from "../../domain/trim";
import { formatPlaybackTime } from "../../domain/playback";

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
    <div className="playback-controls" aria-label="Preview playback controls">
      <div className="transport-buttons">
        <button
          className="transport-button"
          type="button"
          aria-label="Set segment start to current position"
          aria-keyshortcuts="I"
          title={
            canSetSegmentStart
              ? "Set segment start to current position (I)"
              : "Move before the source end to set segment start"
          }
          disabled={!canSetSegmentStart}
          onClick={() => onSetSegmentBoundary("start")}
        >
          <MarkInIcon />
        </button>
        <button
          className="transport-button"
          type="button"
          aria-label="Previous frame"
          aria-keyshortcuts="ArrowLeft"
          title="Previous frame (Left Arrow)"
          onClick={() => onStepFrame(-1)}
        >
          <PreviousFrameIcon />
        </button>
        <button
          className="transport-button transport-button-primary"
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          aria-keyshortcuts="Space"
          title={`${isPlaying ? "Pause" : "Play"} (Space)`}
          onClick={onTogglePlayback}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          className="transport-button"
          type="button"
          aria-label="Next frame"
          aria-keyshortcuts="ArrowRight"
          title="Next frame (Right Arrow)"
          onClick={() => onStepFrame(1)}
        >
          <NextFrameIcon />
        </button>
        <button
          className="transport-button"
          type="button"
          aria-label="Set segment end to current position"
          aria-keyshortcuts="O"
          title={
            canSetSegmentEnd
              ? "Set segment end to current position (O)"
              : "Move after the source start to set segment end"
          }
          disabled={!canSetSegmentEnd}
          onClick={() => onSetSegmentBoundary("end")}
        >
          <MarkOutIcon />
        </button>
      </div>

      {error ? (
        <span className="transport-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

interface PlaybackTimecodeProps {
  currentMicros: number;
  sourceDurationMicros: number;
}

export function PlaybackTimecode({ currentMicros, sourceDurationMicros }: PlaybackTimecodeProps) {
  return (
    <output className="playback-time" aria-label="Current playback time">
      {formatPlaybackTime(currentMicros)}
      <span> / {formatPlaybackTime(sourceDurationMicros)}</span>
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
  return (
    <button
      className="timeline-tool-button"
      type="button"
      aria-label="Safe trim following"
      aria-pressed={safeTrimFollowingEnabled}
      title={
        safeTrimFollowingEnabled
          ? "Safe trim following: on — playhead follows a trim border once caught"
          : "Safe trim following: off — playhead stays in place"
      }
      onClick={onToggleSafeTrimFollowing}
    >
      <LinkPlayheadIcon />
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
    </svg>
  );
}

function MarkInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h2v14H6zm4 1.5 8.5 5.5-8.5 5.5z" />
    </svg>
  );
}

function MarkOutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 5h2v14h-2zM5.5 12 14 6.5v11z" />
    </svg>
  );
}

function LinkPlayheadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.6 13.2a3.9 3.9 0 0 0 5.5 0l2.3-2.3a3.9 3.9 0 0 0-5.5-5.5l-1.3 1.3L12 8.1l1.3-1.3a1.9 1.9 0 1 1 2.7 2.7l-2.3 2.3a1.9 1.9 0 0 1-2.7 0zm4.8-2.4a3.9 3.9 0 0 0-5.5 0l-2.3 2.3a3.9 3.9 0 0 0 5.5 5.5l1.3-1.3-1.4-1.4-1.3 1.3A1.9 1.9 0 1 1 8 14.5l2.3-2.3a1.9 1.9 0 0 1 2.7 0z" />
    </svg>
  );
}

function PreviousFrameIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h2v14H6zm12.5 1.5L10 12l8.5 5.5z" />
    </svg>
  );
}

function NextFrameIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 5h2v14h-2zM5.5 6.5L14 12l-8.5 5.5z" />
    </svg>
  );
}
