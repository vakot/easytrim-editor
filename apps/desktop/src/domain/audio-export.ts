import type { AudioTrackSelection, AudioTrackSettings } from "./audio-processing";

function selectedAudioTracks(tracks: readonly AudioTrackSettings[]): AudioTrackSelection[] {
  return tracks
    .filter((track) => track.enabled)
    .map(({ processing, streamIndex }) => ({
      processing: { ...processing },
      streamIndex,
    }));
}

export { selectedAudioTracks };
