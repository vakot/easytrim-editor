import {
  type AudioTrackSelection,
  type AudioTrackSettings,
  cloneAudioTrackProcessing,
} from "./audio-processing";
import { normalizeMetadataLanguageCode } from "./languages";

function selectedAudioTracks(tracks: readonly AudioTrackSettings[]): AudioTrackSelection[] {
  return tracks
    .filter((track) => track.enabled)
    .map(({ processing, streamIndex }) => ({
      processing: cloneAudioTrackProcessing(processing),
      streamIndex,
    }));
}

function selectedAudioMetadata(tracks: readonly AudioTrackSettings[]) {
  return tracks
    .filter((track) => track.enabled)
    .map(({ metadata, streamIndex }) => {
      const normalizedLanguage = normalizeMetadataLanguageCode(metadata.language);

      return {
        isDefault: metadata.isDefault ?? false,
        ...(normalizedLanguage === undefined ? {} : { language: normalizedLanguage }),
        streamIndex,
        ...(metadata.title === undefined || metadata.title === "" ? {} : { title: metadata.title }),
      };
    });
}

export { selectedAudioMetadata, selectedAudioTracks };
