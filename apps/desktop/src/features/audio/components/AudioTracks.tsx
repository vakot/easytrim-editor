import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimelineState } from "@/app/hooks/useTimeline";
import { useAppSelector } from "@/app/store/redux-hooks";
import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { timelinePercent, type TrimRange } from "@/domain/trim";
import type { AudioStream } from "@/lib/tauri/media.types";

import { useWaveformPreparation } from "../hooks/useWaveformPreparation";

import { AudioTrackRow } from "./AudioTrack/AudioTrackRow";

interface AudioTracksProps {
  streams: AudioStream[];
  tracks: AudioTrackState[];
}

function AudioTracks({ streams, tracks }: AudioTracksProps) {
  useWaveformPreparation(tracks);

  return (
    <div className="relative grid min-w-0 gap-2">
      {streams.map((stream) => {
        const track = tracks.find((candidate) => candidate.streamIndex === stream.streamIndex);
        if (!track) return null;
        return <AudioTrackRow key={stream.streamIndex} stream={stream} track={track} />;
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
      className="pointer-events-none absolute inset-0 inset-x-0 grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
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

export { AudioTracks };
