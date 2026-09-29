import { useCallback, useEffect, useRef, useState } from "react";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioTrackActivityVisibilityToggled,
  audioTrackGainChanged,
  audioTrackProcessingChanged,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
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
  const { clearLiveAudioTrackGain, setLiveAudioTrackGain } = usePlayback();
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
  const liveGainRef = useRef(track?.processing.gainDb ?? 0);
  const initialGainRef = useRef(track?.processing.gainDb ?? 0);
  const gainInteractionKindRef = useRef<"keyboard" | "pointer" | null>(null);
  const gainCommitTimerRef = useRef<number | null>(null);

  const previewTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (gainInteractionKindRef.current === null) {
      liveGainRef.current = liveGainDb;
      initialGainRef.current = liveGainDb;
    }
  }, [liveGainDb]);

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
        dispatch(commitActiveEditingInstanceDraft());
      }
      clearLiveAudioTrackGain(streamIndex, gainDb);
      setLiveGainDraftDb(null);
      initialGainRef.current = gainDb;
    },
    [clearLiveAudioTrackGain, dispatch, streamIndex],
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
      setLiveAudioTrackGain(streamIndex, nextGainDb);

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
    cancelGainInteraction,
    commitPointerGain,
    detectActivity,
    finishGainInteraction,
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
