import {
  type AudioTrackSelection,
  type AudioTrackSettings,
  cloneAudioTrackProcessing,
} from "./audio-processing";

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
    .map(({ isDefault, language, streamIndex, title }) => ({
      isDefault: isDefault ?? false,
      ...(language === undefined ? {} : { language }),
      streamIndex,
      ...(title === undefined ? {} : { title }),
    }));
}

export { selectedAudioMetadata, selectedAudioTracks };
