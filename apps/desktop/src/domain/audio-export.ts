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
    .map(({ isDefault, language, streamIndex, title }) => {
      const normalizedLanguage = normalizeMetadataLanguageCode(language);

      return {
        isDefault: isDefault ?? false,
        ...(normalizedLanguage === undefined ? {} : { language: normalizedLanguage }),
        streamIndex,
        ...(title === undefined || title === "" ? {} : { title }),
      };
    });
}

export { selectedAudioMetadata, selectedAudioTracks };
