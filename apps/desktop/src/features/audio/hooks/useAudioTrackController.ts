import { useCallback } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioTrackActivityVisibilityToggled,
  audioTrackDefaultChanged,
  audioTrackFiltersApplied,
  audioTrackMetadataChanged,
  audioTrackSyncOffsetChanged,
  audioTrackToggled,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { detectTrackActivity } from "@/app/store/thunks/audio-track-thunks";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import {
  areAudioFiltersValid,
  type AudioFilter,
  type AudioSyncOffset,
  isAudioSyncOffsetValid,
  sameAudioFilters,
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

  /** Commits a complete filter chain at once; an invalid chain changes nothing. */
  const applyFilters = useCallback(
    (filters: AudioFilter[], syncOffset?: AudioSyncOffset | null) => {
      if (
        !track ||
        !areAudioFiltersValid(filters) ||
        (syncOffset !== undefined && syncOffset !== null && !isAudioSyncOffsetValid(syncOffset))
      ) {
        return;
      }
      const filtersChanged = !sameAudioFilters(track.processing.filters, filters);
      const currentOffset = track.processing.syncOffset ?? null;
      const offsetChanged =
        syncOffset !== undefined &&
        (currentOffset?.enabled !== syncOffset?.enabled ||
          currentOffset?.offsetMicros !== syncOffset?.offsetMicros);

      if (!filtersChanged && !offsetChanged) return;
      dispatch(audioTrackFiltersApplied({ filters, streamIndex, syncOffset }));
      dispatch(commitActiveEditingInstanceDraft());
    },
    [dispatch, streamIndex, track],
  );

  const changeSyncOffset = useCallback(
    (syncOffset: AudioSyncOffset | null) => {
      if (!track || (syncOffset !== null && !isAudioSyncOffsetValid(syncOffset))) return;
      dispatch(audioTrackSyncOffsetChanged({ streamIndex, syncOffset }));
      dispatch(commitActiveEditingInstanceDraft());
    },
    [dispatch, streamIndex, track],
  );

  const toggleActivityVisibility = useCallback(() => {
    dispatch(audioTrackActivityVisibilityToggled({ streamIndex }));
  }, [dispatch, streamIndex]);

  const detectActivity = useCallback(() => {
    void dispatch(detectTrackActivity(streamIndex));
  }, [dispatch, streamIndex]);

  return {
    applyFilters,
    changeSyncOffset,
    detectActivity,
    durationMicros: media?.durationMicros ?? 0,
    isEnabled: track?.enabled ?? false,
    setDefault,
    setEnabled,
    stream,
    toggleActivityVisibility,
    track,
    trackColor: audioTrackColor(streamIndex),
    trackNumber,
    updateMetadata,
  };
}

export { useAudioTrackController };
