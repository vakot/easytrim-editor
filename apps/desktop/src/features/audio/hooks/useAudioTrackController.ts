import { useCallback } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { audioTrackToggled, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";

function useAudioTrackController(streamIndex: number) {
  const dispatch = useAppDispatch();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const media = useAppSelector(selectSourceMedia);
  const stream = media?.audioStreams.find((candidate) => candidate.streamIndex === streamIndex);
  const streamPosition = media?.audioStreams.findIndex(
    (candidate) => candidate.streamIndex === streamIndex,
  );

  const trackNumber = streamPosition !== undefined && streamPosition >= 0 ? streamPosition + 1 : 0;

  const setEnabled = useCallback(
    (enabled?: boolean) => {
      if (!track) return;
      const nextEnabled = enabled ?? !track.enabled;
      if (nextEnabled === track.enabled) return;
      dispatch(audioTrackToggled({ streamIndex }));
      dispatch(commitActiveEditingInstanceDraft());
    },
    [dispatch, streamIndex, track],
  );

  return {
    isEnabled: track?.enabled ?? false,
    setEnabled,
    stream,
    track,
    trackNumber,
  };
}

export { useAudioTrackController };
