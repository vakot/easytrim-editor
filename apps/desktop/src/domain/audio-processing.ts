type LoudnessPreset = "webVideo" | "streaming" | "broadcast";

interface CustomLoudnessNormalization {
  maxTruePeakDb: number;
  mode: "custom";
  targetLufs: number;
}

type LoudnessNormalization = LoudnessPreset | CustomLoudnessNormalization;

interface AudioTrackProcessing {
  gainDb: number;
  loudnessNormalization?: LoudnessNormalization;
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
  return (
    left.gainDb === right.gainDb &&
    sameLoudnessNormalization(left.loudnessNormalization, right.loudnessNormalization)
  );
}

function sameAudioTrackPreviewProcessing(
  left: AudioTrackProcessing,
  right: AudioTrackProcessing,
): boolean {
  return sameLoudnessNormalization(left.loudnessNormalization, right.loudnessNormalization);
}

function sameLoudnessNormalization(
  left: LoudnessNormalization | undefined,
  right: LoudnessNormalization | undefined,
): boolean {
  if (left === right) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  return left.targetLufs === right.targetLufs && left.maxTruePeakDb === right.maxTruePeakDb;
}

function cloneAudioTrackProcessing(processing: AudioTrackProcessing): AudioTrackProcessing {
  return {
    gainDb: processing.gainDb,
    ...(processing.loudnessNormalization === undefined
      ? {}
      : {
          loudnessNormalization:
            typeof processing.loudnessNormalization === "string"
              ? processing.loudnessNormalization
              : { ...processing.loudnessNormalization },
        }),
  };
}

const DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION: CustomLoudnessNormalization = {
  mode: "custom",
  targetLufs: -16,
  maxTruePeakDb: -1.5,
};

export type {
  AudioTrackProcessing,
  AudioTrackSelection,
  AudioTrackSettings,
  CustomLoudnessNormalization,
  LoudnessNormalization,
  LoudnessPreset,
};
export {
  cloneAudioTrackProcessing,
  DEFAULT_AUDIO_TRACK_PROCESSING,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  sameAudioTrackPreviewProcessing,
  sameAudioTrackProcessing,
};
