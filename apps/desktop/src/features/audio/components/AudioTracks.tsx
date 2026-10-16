import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";

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

/** One line across every row at the timeline playhead, positioned purely by the shared CSS. */
function AudioPlayhead() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) gap-3"
      data-slot="audio-playhead-grid"
    >
      <div className="relative col-start-2">
        <div
          className="absolute inset-y-0 left-(--timeline-playhead-position) w-0 -translate-x-1/2 border-l-[0.125rem] border-dashed border-foreground/70"
          data-slot="audio-playhead"
        />
      </div>
    </div>
  );
}

export { AudioTracks };
