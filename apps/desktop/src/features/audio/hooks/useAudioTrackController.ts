import { useCallback, useEffect, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioTrackActivityVisibilityToggled,
  audioTrackGainChanged,
  audioTrackLoudnessNormalizationChanged,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import {
  analyzeTrackLoudness,
  detectTrackActivity,
  prepareTrackPreview,
} from "@/app/store/thunks/audio-track-thunks";
import type { LoudnessPreset } from "@/domain/audio-processing";

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

  const setGain = useCallback(
    (gainDb: number) => {
      if (!track || track.processing.gainDb === gainDb) return;
      dispatch(audioTrackGainChanged({ gainDb, streamIndex }));
      dispatch(commitActiveEditingInstanceDraft());
      schedulePreviewPreparation();
    },
    [dispatch, schedulePreviewPreparation, streamIndex, track],
  );

  const setNormalization = useCallback(
    (preset: LoudnessPreset | null) => {
      if (!track || track.processing.loudnessNormalization === (preset ?? undefined)) return;
      dispatch(audioTrackLoudnessNormalizationChanged({ preset, streamIndex }));
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
    detectActivity,
    setEnabled,
    setGain,
    setNormalization,
    toggleActivityVisibility,
    track,
  };
}

export { useAudioTrackController };
export type AudioTrackController = ReturnType<typeof useAudioTrackController>;
