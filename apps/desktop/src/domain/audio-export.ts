import type { AudioTrackSelection } from "./media";

interface SelectedAudioTrack {
  enabled: boolean;
  streamIndex: number;
  volumePercent: number;
}

interface MasterAudioSettings {
  enabled: boolean;
  volumePercent: number;
}

function selectedAudioTracks(
  tracks: readonly SelectedAudioTrack[],
  master: MasterAudioSettings,
): AudioTrackSelection[] {
  const masterGain = master.enabled ? master.volumePercent / 50 : 0;
  return tracks
    .filter((track) => track.enabled && track.volumePercent > 0 && masterGain > 0)
    .map((track) => ({
      streamIndex: track.streamIndex,
      volumePercent: Math.min(200, Math.round(track.volumePercent * masterGain)),
    }))
    .filter((track) => track.volumePercent > 0);
}

export { selectedAudioTracks };
