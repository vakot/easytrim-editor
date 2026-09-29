type LoudnessPreset = "webVideo" | "streaming" | "broadcast";

interface AudioTrackProcessing {
  gainDb: number;
  loudnessNormalization?: LoudnessPreset;
}

interface AudioTrackSettings {
  enabled: boolean;
  processing: AudioTrackProcessing;
  streamIndex: number;
}

interface AudioTrackSelection {
  processing: AudioTrackProcessing;
  streamIndex: number;
}

const DEFAULT_AUDIO_TRACK_PROCESSING: AudioTrackProcessing = { gainDb: 0 };

function sameAudioTrackProcessing(
  left: AudioTrackProcessing,
  right: AudioTrackProcessing,
): boolean {
  return left.gainDb === right.gainDb && left.loudnessNormalization === right.loudnessNormalization;
}

export type { AudioTrackProcessing, AudioTrackSelection, AudioTrackSettings, LoudnessPreset };
export { DEFAULT_AUDIO_TRACK_PROCESSING, sameAudioTrackProcessing };
