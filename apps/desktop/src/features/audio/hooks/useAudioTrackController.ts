import { useCallback, useEffect, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioTrackActivityVisibilityToggled,
  audioTrackGainChanged,
  audioTrackProcessingChanged,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import {
  analyzeTrackLoudness,
  detectTrackActivity,
  prepareTrackPreview,
} from "@/app/store/thunks/audio-track-thunks";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import {
  type AudioTrackProcessing,
  cloneAudioTrackProcessing,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";

function useAudioTrackController(streamIndex: number) {
  const dispatch = useAppDispatch();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const previewTimerRef = useRef<number | null>(null);

  const schedulePreviewPreparation = useCallback(() => {
    if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      previewTimerRef.current = null;
      void dispatch(prepareTrackPreview(streamIndex));
    }, 250);
  }, [dispatch, streamIndex]);

  useEffect(
    () => () => {
      if (previewTimerRef.current !== null) window.clearTimeout(previewTimerRef.current);
    },
    [],
  );

  const setEnabled = useCallback(() => {
    dispatch(audioTrackToggled({ streamIndex }));
    dispatch(commitActiveEditingInstanceDraft());
  }, [dispatch, streamIndex]);

  const commitGain = useCallback(
    (gainDb: number) => {
      if (!track || track.processing.gainDb === gainDb) return;
      dispatch(audioTrackGainChanged({ gainDb, streamIndex }));
      dispatch(commitActiveEditingInstanceDraft());
    },
    [dispatch, streamIndex, track],
  );

  const applyProcessing = useCallback(
    (processing: AudioTrackProcessing) => {
      if (!track || sameAudioTrackProcessing(track.processing, processing)) return;
      dispatch(
        audioTrackProcessingChanged({
          processing: cloneAudioTrackProcessing(processing),
          streamIndex,
        }),
      );
      dispatch(commitActiveEditingInstanceDraft());
      schedulePreviewPreparation();
    },
    [dispatch, schedulePreviewPreparation, streamIndex, track],
  );

  const toggleActivityVisibility = useCallback(() => {
    dispatch(audioTrackActivityVisibilityToggled({ streamIndex }));
  }, [dispatch, streamIndex]);

  const analyzeLoudness = useCallback(() => {
    void dispatch(analyzeTrackLoudness(streamIndex));
  }, [dispatch, streamIndex]);

  const detectActivity = useCallback(() => {
    void dispatch(detectTrackActivity(streamIndex));
  }, [dispatch, streamIndex]);

  return {
    analyzeLoudness,
    applyProcessing,
    commitGain,
    detectActivity,
    setEnabled,
    toggleActivityVisibility,
    track,
  };
}

export { useAudioTrackController };
export type AudioTrackController = ReturnType<typeof useAudioTrackController>;
