import { useCallback, useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import type { AudioTrackState } from "@/app/store/slices/audio-slice";
import { selectSourceReady, selectSourceSelection } from "@/app/store/slices/source-slice";
import { prepareSourceWaveforms } from "@/app/store/thunks/source-media-thunks";

export const WAVEFORM_RENDER_WIDTH = 4096;

function useWaveformPreparation(tracks: AudioTrackState[]) {
  const dispatch = useAppDispatch();
  const sourceReady = useAppSelector(selectSourceReady);
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;

  useEffect(() => {
    if (!sourceReady || !sourcePath) return;

    const streamIndexes = tracks
      .filter((track) => track.waveform.status === "idle")
      .map((track) => track.streamIndex);

    if (streamIndexes.length === 0) return;

    void dispatch(prepareSourceWaveforms(sourcePath, streamIndexes, WAVEFORM_RENDER_WIDTH));
  }, [dispatch, sourcePath, sourceReady, tracks]);
}

function useWaveformPrepare(streamIndex: number, waveform: AudioTrackState["waveform"]) {
  const dispatch = useAppDispatch();
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;

  const width = waveform.status === "idle" ? WAVEFORM_RENDER_WIDTH : waveform.width;

  return useCallback(() => {
    if (!sourcePath) return;

    void dispatch(prepareSourceWaveforms(sourcePath, [streamIndex], width));
  }, [dispatch, sourcePath, streamIndex, width]);
}

export { useWaveformPreparation, useWaveformPrepare };
