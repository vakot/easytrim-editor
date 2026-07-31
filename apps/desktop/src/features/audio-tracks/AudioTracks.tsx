import { useEffect, type RefObject } from "react";

import type { AudioTrackState } from "../../app/session-state";
import { timelinePercent, type TrimRange } from "../../domain/trim";
import type { AudioStream } from "../../lib/tauri/media";

const WAVEFORM_RENDER_WIDTH = 4096;

interface AudioTracksProps {
  streams: AudioStream[];
  tracks: AudioTrackState[];
  masterVolumePercent: number;
  range: TrimRange;
  playheadMicros: number;
  playheadRef: RefObject<HTMLDivElement | null>;
  mergeAudio: boolean;
  onToggleTrack: (streamIndex: number) => void;
  onSetAllTracksEnabled: (enabled: boolean) => void;
  onTrackVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onSetAllTracksVolume: (volumePercent: number) => void;
  onToggleMerge: () => void;
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onWaveformImageError: (streamIndex: number) => void;
}

export function AudioTracks({
  streams,
  tracks,
  masterVolumePercent,
  range,
  playheadMicros,
  playheadRef,
  mergeAudio,
  onToggleTrack,
  onSetAllTracksEnabled,
  onTrackVolumeChange,
  onSetAllTracksVolume,
  onToggleMerge,
  onPrepareWaveforms,
  onWaveformImageError,
}: AudioTracksProps) {
  const startPercent = timelinePercent(range.startMicros, range.sourceDurationMicros);
  const endPercent = timelinePercent(range.endMicros, range.sourceDurationMicros);
  const playheadPercent = timelinePercent(playheadMicros, range.sourceDurationMicros);
  const enabledCount = tracks.filter((track) => track.enabled).length;
  const outputSummary = audioOutputSummary(enabledCount, mergeAudio);
  const allTracksEnabled = enabledCount === tracks.length;

  useEffect(() => {
    const pending = tracks
      .filter((track) => track.waveform.status === "idle")
      .map((track) => track.streamIndex);
    if (pending.length > 0) {
      onPrepareWaveforms(pending, WAVEFORM_RENDER_WIDTH);
    }
  }, [onPrepareWaveforms, tracks]);

  if (streams.length === 0) {
    return <p className="timeline-empty-audio">This source has no audio tracks.</p>;
  }

  return (
    <section className="timeline-audio" aria-labelledby="timeline-audio-title">
      <h3 id="timeline-audio-title" className="section-label">
        Audio tracks
      </h3>
      <div className="timeline-row timeline-audio-heading">
        <div className="audio-master-control">
          <VolumeButton
            enabled={allTracksEnabled}
            label="All audio tracks"
            onClick={() => onSetAllTracksEnabled(!allTracksEnabled)}
          />
          <AudioLevelControl
            label="All audio tracks volume"
            volumePercent={allTracksEnabled ? masterVolumePercent : 0}
            onChange={onSetAllTracksVolume}
          />
          <div>
            <span className="audio-track-title">All tracks</span>
            <span className="audio-track-meta" title={outputSummary}>
              {outputSummary}
            </span>
          </div>
        </div>
        <div className="timeline-audio-summary">
          <label className="merge-audio-control">
            <input type="checkbox" checked={mergeAudio} onChange={onToggleMerge} />
            <span>Merge selected tracks</span>
          </label>
        </div>
      </div>

      <div className="audio-track-list">
        {streams.map((stream, index) => {
          const track = tracks.find((candidate) => candidate.streamIndex === stream.streamIndex);
          if (!track) {
            return null;
          }
          const title = stream.title ?? stream.language ?? `Audio ${index + 1}`;
          return (
            <div className="timeline-row audio-track-row" key={stream.streamIndex}>
              <div className="audio-track-label">
                <VolumeButton
                  enabled={track.enabled}
                  label={`${track.enabled ? "Mute" : "Enable"} ${title}`}
                  onClick={() => onToggleTrack(stream.streamIndex)}
                />
                <AudioLevelControl
                  label={`${title} volume`}
                  volumePercent={track.enabled ? track.volumePercent : 0}
                  onChange={(volumePercent) =>
                    onTrackVolumeChange(stream.streamIndex, volumePercent)
                  }
                />
                <span className="audio-track-title" title={title}>
                  {title}
                </span>
                <span className="audio-track-meta">
                  #{stream.streamIndex} · {stream.codecName.toUpperCase()} ·{" "}
                  {formatChannels(stream)}
                </span>
              </div>
              <div className="audio-waveform-track" data-enabled={track.enabled}>
                <WaveformContent
                  track={track}
                  onRetry={() =>
                    onPrepareWaveforms(
                      [stream.streamIndex],
                      waveformStateWidth(track) || WAVEFORM_RENDER_WIDTH,
                    )
                  }
                  onImageError={() => onWaveformImageError(stream.streamIndex)}
                />
                <div
                  className="audio-trim-selection"
                  aria-hidden="true"
                  style={{ left: `${startPercent}%`, right: `${100 - endPercent}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="audio-playhead-layer" aria-hidden="true">
          <div
            ref={playheadRef}
            className="audio-playhead"
            style={{ left: `${playheadPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function AudioLevelControl({
  label,
  volumePercent,
  onChange,
}: {
  label: string;
  volumePercent: number;
  onChange: (volumePercent: number) => void;
}) {
  return (
    <div className="audio-level-control">
      <input
        className="audio-volume-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={volumePercent}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        title="50% is the original level"
      />
      <output>{formatDecibels(volumePercent)}</output>
    </div>
  );
}

function VolumeButton({
  enabled,
  label,
  onClick,
}: {
  enabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="audio-volume-button"
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      title={enabled ? `${label}: enabled` : `${label}: muted`}
      onClick={onClick}
    >
      <VolumeIcon muted={!enabled} />
    </button>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9z" />
      {muted ? (
        <path d="m17 9 4 6m0-6-4 6" />
      ) : (
        <path d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10" />
      )}
    </svg>
  );
}

function WaveformContent({
  track,
  onRetry,
  onImageError,
}: {
  track: AudioTrackState;
  onRetry: () => void;
  onImageError: () => void;
}) {
  switch (track.waveform.status) {
    case "idle":
    case "loading":
      return (
        <span className="waveform-status" role="status">
          Preparing waveform…
        </span>
      );
    case "ready":
      return (
        <img
          className="waveform-image"
          src={track.waveform.url}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={onImageError}
        />
      );
    case "failed":
      return (
        <div className="waveform-failure">
          <span title={track.waveform.error.message}>Waveform unavailable</span>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      );
  }
}

function waveformStateWidth(track: AudioTrackState): number | null {
  return track.waveform.status === "idle" ? null : track.waveform.width;
}

function formatChannels(stream: AudioStream): string {
  if (stream.channelLayout) {
    return stream.channelLayout;
  }
  return stream.channels === undefined
    ? "unknown layout"
    : `${stream.channels} channel${stream.channels === 1 ? "" : "s"}`;
}

function formatDecibels(volumePercent: number): string {
  if (volumePercent <= 0) {
    return "−∞ dB";
  }
  const decibels = 20 * Math.log10(volumePercent / 50);
  return `${decibels >= 0 ? "+" : ""}${decibels.toFixed(1)} dB`;
}

function audioOutputSummary(enabledCount: number, mergeAudio: boolean): string {
  if (enabledCount === 0) {
    return "Video-only output";
  }
  if (mergeAudio && enabledCount > 1) {
    return "Fast cut + audio merge — video stays copied; selected audio is encoded.";
  }
  if (mergeAudio) {
    return "One selected track — no merge is needed.";
  }
  return `${enabledCount} selected track${enabledCount === 1 ? "" : "s"} kept separately.`;
}
