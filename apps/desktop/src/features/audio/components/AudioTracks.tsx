import type { RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { timelinePercent, type TrimRange } from "@/domain/trim";
import type { AudioStream } from "@/lib/tauri/media.types";

import { useWaveformPreparation } from "../hooks/useWaveformPreparation";

import { AudioTrackRow } from "./AudioTrackRow";

interface AudioTracksProps {
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onToggleTrack: (streamIndex: number) => void;
  onTrackVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onWaveformImageError: (streamIndex: number) => void;
  playheadMicros: number;
  playheadRef: RefObject<HTMLDivElement | null>;
  range: TrimRange;
  streams: AudioStream[];
  tracks: AudioTrackState[];
  waveformPreparationEnabled: boolean;
}

export function AudioTracks({
  onPrepareWaveforms,
  onToggleTrack,
  onTrackVolumeChange,
  onWaveformImageError,
  playheadMicros,
  playheadRef,
  range,
  streams,
  tracks,
  waveformPreparationEnabled,
}: AudioTracksProps) {
  const { t } = useTranslation();
  const playheadPercent = timelinePercent(playheadMicros, range.sourceDurationMicros);

  useWaveformPreparation(tracks, waveformPreparationEnabled, onPrepareWaveforms);

  return (
    <div className="relative grid min-w-0 gap-2">
      {streams.map((stream, index) => {
        const track = tracks.find((candidate) => candidate.streamIndex === stream.streamIndex);

        if (!track) return null;
        const title =
          stream.title ?? stream.language ?? t("audio.labels.defaultTrack", { number: index + 1 });

        return (
          <AudioTrackRow
            key={stream.streamIndex}
            onPrepareWaveform={onPrepareWaveforms}
            onToggle={onToggleTrack}
            onVolumeChange={onTrackVolumeChange}
            onWaveformImageError={onWaveformImageError}
            stream={stream}
            title={title}
            track={track}
          />
        );
      })}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 inset-x-0 grid min-w-0 grid-cols-(--editor-track-grid-columns) gap-3"
        data-slot="audio-playhead-grid"
      >
        <div className="relative col-start-2 mx-px" data-slot="audio-playhead-track">
          <div
            className="audio-playhead absolute inset-y-0 border-l border-dashed border-foreground/70"
            ref={playheadRef}
            style={{ left: `${playheadPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
