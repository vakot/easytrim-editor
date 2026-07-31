import { useEffect, useRef, type RefObject } from "react";

import type { AudioTrackState } from "../../app/session-state";
import { timelinePercent, type TrimRange } from "../../domain/trim";
import type { AudioStream } from "../../lib/tauri/media";

const WAVEFORM_RENDER_WIDTH = 4096;

interface AudioTracksProps {
  streams: AudioStream[];
  tracks: AudioTrackState[];
  range: TrimRange;
  playheadMicros: number;
  playheadRef: RefObject<HTMLDivElement | null>;
  mergeAudio: boolean;
  onToggleTrack: (streamIndex: number) => void;
  onSetAllTracksEnabled: (enabled: boolean) => void;
  onToggleMerge: () => void;
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onWaveformImageError: (streamIndex: number) => void;
}

export function AudioTracks({
  streams,
  tracks,
  range,
  playheadMicros,
  playheadRef,
  mergeAudio,
  onToggleTrack,
  onSetAllTracksEnabled,
  onToggleMerge,
  onPrepareWaveforms,
  onWaveformImageError,
}: AudioTracksProps) {
  const startPercent = timelinePercent(range.startMicros, range.sourceDurationMicros);
  const endPercent = timelinePercent(range.endMicros, range.sourceDurationMicros);
  const playheadPercent = timelinePercent(playheadMicros, range.sourceDurationMicros);
  const enabledCount = tracks.filter((track) => track.enabled).length;
  const outputSummary = audioOutputSummary(enabledCount, mergeAudio);
  const masterCheckboxRef = useRef<HTMLInputElement>(null);
  const allTracksEnabled = enabledCount === tracks.length;
  const someTracksEnabled = enabledCount > 0 && !allTracksEnabled;

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = someTracksEnabled;
    }
  }, [someTracksEnabled]);

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
        <label className="audio-master-control">
          <input
            ref={masterCheckboxRef}
            type="checkbox"
            checked={allTracksEnabled}
            onChange={() => onSetAllTracksEnabled(!allTracksEnabled)}
            aria-label="All audio tracks"
            title={allTracksEnabled ? "Disable all audio tracks" : "Enable all audio tracks"}
          />
          <span className="audio-track-title">All tracks</span>
          <span className="audio-track-meta" title={outputSummary}>
            {outputSummary}
          </span>
        </label>
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
              <label className="audio-track-label">
                <input
                  type="checkbox"
                  checked={track.enabled}
                  onChange={() => onToggleTrack(stream.streamIndex)}
                  aria-label={`Include ${title}`}
                />
                <span className="audio-track-title" title={title}>
                  {title}
                </span>
                <span className="audio-track-meta">
                  #{stream.streamIndex} · {stream.codecName.toUpperCase()} ·{" "}
                  {formatChannels(stream)}
                </span>
              </label>
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
