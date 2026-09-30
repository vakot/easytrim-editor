import { useCallback, useEffect, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioTrackActivityVisibilityToggled,
  audioTrackGainChanged,
  audioTrackProcessingChanged,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { analyzeTrackLoudness, detectTrackActivity } from "@/app/store/thunks/audio-track-thunks";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import {
  type AudioTrackProcessing,
  cloneAudioTrackProcessing,
  sameAudioTrackProcessing,
} from "@/domain/audio-processing";
import { useAudioPlayback } from "@/features/audio";

import { MIN_SLIDER_DECIBELS } from "../lib/audio-level.utils";
import { audioTrackColor } from "../lib/audio-track-color";

const GAIN_KEYBOARD_COMMIT_DELAY_MS = 300;
const GAIN_ADJUSTMENT_KEYS = [
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
];

function useAudioTrackController(streamIndex: number) {
  const dispatch = useAppDispatch();
  const { clearLiveAudioTrackGain, setLiveAudioTrackGain } = useAudioPlayback();
  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const media = useAppSelector(selectSourceMedia);
  const stream = media?.audioStreams.find((candidate) => candidate.streamIndex === streamIndex);
  const streamPosition = media?.audioStreams.findIndex(
    (candidate) => candidate.streamIndex === streamIndex,
  );

  const trackNumber = streamPosition !== undefined && streamPosition >= 0 ? streamPosition + 1 : 0;
  const trackColor = audioTrackColor(streamIndex);
  const [liveGainDraftDb, setLiveGainDraftDb] = useState<number | null>(null);
  const liveGainDb = liveGainDraftDb ?? track?.processing.gainDb ?? 0;
  const gainSliderDb = liveGainDraftDb ?? (track?.enabled ? liveGainDb : MIN_SLIDER_DECIBELS);

  const isEnabled =
    liveGainDraftDb === null ? (track?.enabled ?? false) : gainSliderDb > MIN_SLIDER_DECIBELS;

  const liveGainRef = useRef(track?.processing.gainDb ?? 0);
  const initialGainRef = useRef(track?.processing.gainDb ?? 0);
  const gainInteractionKindRef = useRef<"keyboard" | "pointer" | null>(null);
  const gainCommitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (gainInteractionKindRef.current === null) {
      const sliderGainDb = track?.enabled ? liveGainDb : MIN_SLIDER_DECIBELS;
      liveGainRef.current = sliderGainDb;
      initialGainRef.current = sliderGainDb;
    }
  }, [liveGainDb, track?.enabled]);

  const finishGainInteraction = useCallback(
    (gainDb = liveGainRef.current) => {
      if (gainInteractionKindRef.current === null) return;
      gainInteractionKindRef.current = null;
      if (gainCommitTimerRef.current !== null) {
        window.clearTimeout(gainCommitTimerRef.current);
        gainCommitTimerRef.current = null;
      }
      if (gainDb !== initialGainRef.current) {
        dispatch(audioTrackGainChanged({ gainDb, streamIndex }));
      }
      const shouldEnableTrack = gainDb > MIN_SLIDER_DECIBELS;
      if (track && track.enabled !== shouldEnableTrack) {
        dispatch(audioTrackToggled({ streamIndex }));
      }
      if (track && (gainDb !== initialGainRef.current || track.enabled !== shouldEnableTrack)) {
        dispatch(commitActiveEditingInstanceDraft());
      }
      clearLiveAudioTrackGain(streamIndex, shouldEnableTrack ? gainDb : Number.NEGATIVE_INFINITY);
      setLiveGainDraftDb(null);
      initialGainRef.current = shouldEnableTrack ? gainDb : MIN_SLIDER_DECIBELS;
    },
    [clearLiveAudioTrackGain, dispatch, streamIndex, track],
  );

  const startGainInteraction = useCallback((kind: "keyboard" | "pointer") => {
    if (gainInteractionKindRef.current === null) initialGainRef.current = liveGainRef.current;
    gainInteractionKindRef.current = kind;
  }, []);

  const updateLiveGain = useCallback(
    (values: number[]) => {
      const nextGainDb = values[0];
      if (nextGainDb === undefined) return;
      if (gainInteractionKindRef.current === null) startGainInteraction("pointer");
      liveGainRef.current = nextGainDb;
      setLiveGainDraftDb(nextGainDb);
      setLiveAudioTrackGain(
        streamIndex,
        nextGainDb <= MIN_SLIDER_DECIBELS ? Number.NEGATIVE_INFINITY : nextGainDb,
      );

      if (gainInteractionKindRef.current === "keyboard") {
        if (gainCommitTimerRef.current !== null) window.clearTimeout(gainCommitTimerRef.current);
        gainCommitTimerRef.current = window.setTimeout(
          () => finishGainInteraction(),
          GAIN_KEYBOARD_COMMIT_DELAY_MS,
        );
      }
    },
    [finishGainInteraction, setLiveAudioTrackGain, startGainInteraction, streamIndex],
  );

  const handleGainKeyDown = useCallback(
    (key: string) => {
      if (key === "Enter") finishGainInteraction();
      else if (GAIN_ADJUSTMENT_KEYS.includes(key)) startGainInteraction("keyboard");
    },
    [finishGainInteraction, startGainInteraction],
  );

  const handleGainKeyUp = useCallback(
    (key: string) => {
      if (gainInteractionKindRef.current === "keyboard" && key.startsWith("Arrow"))
        finishGainInteraction();
    },
    [finishGainInteraction],
  );

  const startPointerGainInteraction = useCallback(
    () => startGainInteraction("pointer"),
    [startGainInteraction],
  );

  const cancelGainInteraction = useCallback(() => finishGainInteraction(), [finishGainInteraction]);

  const commitPointerGain = useCallback(
    (values: number[]) => {
      if (gainInteractionKindRef.current === "pointer") finishGainInteraction(values[0]);
    },
    [finishGainInteraction],
  );

  useEffect(
    () => () => {
      if (gainCommitTimerRef.current !== null) window.clearTimeout(gainCommitTimerRef.current);
      if (gainInteractionKindRef.current !== null) {
        clearLiveAudioTrackGain(streamIndex, liveGainRef.current);
      }
    },
    [clearLiveAudioTrackGain, streamIndex],
  );

  const setEnabled = useCallback(
    (enabled?: boolean) => {
      if (!track) return;
      const nextEnabled = enabled ?? !track.enabled;
      if (nextEnabled === track.enabled) return;
      if (
        nextEnabled &&
        track.processing.loudnessNormalization === undefined &&
        track.processing.gainDb <= MIN_SLIDER_DECIBELS
      ) {
        dispatch(audioTrackGainChanged({ gainDb: 0, streamIndex }));
      }
      dispatch(audioTrackToggled({ streamIndex }));
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
    },
    [dispatch, streamIndex, track],
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
    cancelGainInteraction,
    commitPointerGain,
    detectActivity,
    finishGainInteraction,
    gainSliderDb,
    isEnabled,
    handleGainKeyDown,
    handleGainKeyUp,
    liveGainDb,
    setEnabled,
    startPointerGainInteraction,
    toggleActivityVisibility,
    track,
    trackColor,
    trackNumber,
    stream,
    updateLiveGain,
  };
}

export { useAudioTrackController };
export type AudioTrackController = ReturnType<typeof useAudioTrackController>;
