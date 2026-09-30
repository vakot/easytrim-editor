import { useCallback } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { analyzeTrackLoudness } from "@/app/store/thunks/audio-track-thunks";
import { audioTrackLoudnessInputsKey, type AudioTrackProcessing } from "@/domain/audio-processing";

function useLoudnessAnalysis(streamIndex: number, processing: AudioTrackProcessing) {
  const dispatch = useAppDispatch();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const trim = useAppSelector(selectTrim);
  const source = useAppSelector(selectSourceSelection);
  const analysis = track?.loudnessAnalysis;
  const cacheKey =
    track && trim && source
      ? audioTrackLoudnessInputsKey(source.sourcePath, track.streamIndex, trim, processing)
      : undefined;

  const isReady = analysis?.status === "ready" && analysis.cacheKey === cacheKey;
  const value = isReady && analysis.status === "ready" ? analysis.value : undefined;
  const isLoading = analysis?.status === "loading" && analysis.cacheKey === cacheKey;
  const isFailed = analysis?.status === "failed" && analysis.cacheKey === cacheKey;
  const error = isFailed && analysis.status === "failed" ? analysis.error.message : undefined;

  const analyze = useCallback(() => {
    void dispatch(analyzeTrackLoudness(streamIndex, processing));
  }, [dispatch, processing, streamIndex]);

  return {
    analyze,
    error,
    hasTrack: track !== undefined,
    isFailed,
    isLoading,
    isReady,
    value,
  };
}

export { useLoudnessAnalysis };
