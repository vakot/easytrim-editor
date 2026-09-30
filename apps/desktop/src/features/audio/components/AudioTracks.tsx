import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { timelinePercent, type TrimRange } from "@/domain/trim";
import { useAudioPlayback } from "@/features/audio";
import { useTimelinePlayhead } from "@/features/timeline";

import { useWaveformPreparation } from "../hooks/useWaveformPreparation";

import { AudioTrackRow } from "./AudioTrack/AudioTrackRow";

function AudioTracks() {
  const streams = useAppSelector((state) => selectSourceMedia(state)?.audioStreams ?? []);
  const tracks = useAppSelector(selectAudioTracks);
  useWaveformPreparation(tracks);

  return (
    <div className="relative grid min-w-0 gap-2">
      {streams.map((stream) => (
        <AudioTrackRow key={stream.streamIndex} streamIndex={stream.streamIndex} />
      ))}
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
  const { audioPlayheadRef } = useAudioPlayback();
  const { displayedPlayheadMicros } = useTimelinePlayhead();
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
