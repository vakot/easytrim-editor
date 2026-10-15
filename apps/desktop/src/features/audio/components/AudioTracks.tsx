import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";

import { AudioTrackRow } from "./AudioTrack/AudioTrackRow";

function AudioTracks() {
  const streams = useAppSelector((state) => selectSourceMedia(state)?.audioStreams ?? []);

  return (
    <div className="grid min-w-0 gap-2">
      {streams.map((stream) => (
        <AudioTrackRow key={stream.streamIndex} streamIndex={stream.streamIndex} />
      ))}
    </div>
  );
}

export { AudioTracks };
