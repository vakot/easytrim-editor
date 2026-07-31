import { formatPlaybackTime } from "../../domain/playback";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentMicros: number;
  sourceDurationMicros: number;
  error: string | null;
  onTogglePlayback: () => void;
  onStepFrame: (direction: -1 | 1) => void;
}

export function PlaybackControls({
  isPlaying,
  currentMicros,
  sourceDurationMicros,
  error,
  onTogglePlayback,
  onStepFrame,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls" aria-label="Preview playback controls">
      <div className="transport-buttons">
        <button
          className="transport-button"
          type="button"
          aria-label="Previous frame"
          title="Previous frame"
          onClick={() => onStepFrame(-1)}
        >
          <PreviousFrameIcon />
        </button>
        <button
          className="transport-button transport-button-primary"
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
          onClick={onTogglePlayback}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          className="transport-button"
          type="button"
          aria-label="Next frame"
          title="Next frame"
          onClick={() => onStepFrame(1)}
        >
          <NextFrameIcon />
        </button>
      </div>

      <output className="playback-time" aria-label="Current playback time">
        {formatPlaybackTime(currentMicros)}
        <span> / {formatPlaybackTime(sourceDurationMicros)}</span>
      </output>

      {error ? (
        <span className="transport-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
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
