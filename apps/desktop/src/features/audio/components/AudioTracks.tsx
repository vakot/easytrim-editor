import { useTranslation } from "react-i18next";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimelineState } from "@/app/hooks/useTimeline";
import { useAppSelector } from "@/app/store/redux-hooks";
import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { timelinePercent, type TrimRange } from "@/domain/trim";
import type { AudioStream } from "@/lib/tauri/media.types";

import { useWaveformPreparation } from "../hooks/useWaveformPreparation";

import { AudioTrackRow } from "./AudioTrackRow";

interface AudioTracksProps {
  onCommit: () => void;
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onToggleTrack: (streamIndex: number) => void;
  onTrackVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onWaveformImageError: (streamIndex: number) => void;
  streams: AudioStream[];
  tracks: AudioTrackState[];
  waveformPreparationEnabled: boolean;
}

export function AudioTracks({
  onCommit,
  onPrepareWaveforms,
  onToggleTrack,
  onTrackVolumeChange,
  onWaveformImageError,
  streams,
  tracks,
  waveformPreparationEnabled,
}: AudioTracksProps) {
  const { t } = useTranslation();
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
            onCommit={onCommit}
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
      <AudioPlayhead />
    </div>
  );
}

const EMPTY_TIMELINE_RANGE: TrimRange = {
  startMicros: 0,
  endMicros: 1_000_000,
  sourceDurationMicros: 1_000_000,
};

function AudioPlayhead() {
  const { audioPlayheadRef } = usePlayback();
  const { displayedPlayheadMicros } = useTimelineState();
  const range = useAppSelector(selectTrim) ?? EMPTY_TIMELINE_RANGE;
  const playheadPercent = timelinePercent(displayedPlayheadMicros, range.sourceDurationMicros);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 inset-x-0 grid min-w-0 grid-cols-(--editor-audio-track-grid-columns) gap-3"
      data-slot="audio-playhead-grid"
    >
      <div className="relative col-start-2 mx-px" data-slot="audio-playhead-track">
        <div
          className="audio-playhead absolute inset-y-0 border-l border-dashed border-foreground/70"
          ref={audioPlayheadRef}
          style={{ left: `${playheadPercent}%` }}
        />
      </div>
    </div>
  );
}
