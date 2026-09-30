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

export { selectedAudioTracks };
