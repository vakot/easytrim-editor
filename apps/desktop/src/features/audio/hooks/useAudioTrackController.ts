import { useCallback } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioTrackActivityVisibilityToggled,
  audioTrackDefaultChanged,
  audioTrackMetadataChanged,
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
import {
  type Language,
  languageCodeFromMetadata,
  metadataCodeFromLanguage,
} from "@/domain/languages";

import { audioTrackColor } from "../lib/audio-track-color";

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
  const trackColor = audioTrackColor(streamIndex);
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

  const setDefault = useCallback(() => {
    if (!track?.enabled || track.metadata.isDefault) return;
    dispatch(audioTrackDefaultChanged({ streamIndex }));
    dispatch(commitActiveEditingInstanceDraft());
  }, [dispatch, streamIndex, track]);

  const updateMetadata = useCallback(
    (
      title: string,
      titleChanged: boolean,
      language: Language["code"] | undefined,
      languageChanged: boolean,
    ) => {
      if (!track || !stream) return;
      const nextTitle = titleChanged ? (title === "" ? undefined : title) : track.metadata.title;
      const nextLanguage = languageChanged
        ? language === languageCodeFromMetadata(stream.language)
          ? undefined
          : language === undefined
            ? undefined
            : metadataCodeFromLanguage(language)
        : track.metadata.language;

      if (track.metadata.title === nextTitle && track.metadata.language === nextLanguage) return;
      dispatch(
        audioTrackMetadataChanged({ language: nextLanguage, streamIndex, title: nextTitle }),
      );
      dispatch(commitActiveEditingInstanceDraft());
    },
    [dispatch, stream, streamIndex, track],
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
    detectActivity,
    isEnabled: track?.enabled ?? false,
    setEnabled,
    setDefault,
    toggleActivityVisibility,
    track,
    trackColor,
    trackNumber,
    stream,
    updateMetadata,
  };
}

export { useAudioTrackController };
export type AudioTrackController = ReturnType<typeof useAudioTrackController>;
