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
  loudnessAnalysis?: AudioLoudnessAnalysis;
  processing: AudioTrackProcessing;
  streamIndex: number;
}

interface AudioLoudnessAnalysis {
  integratedLufs?: number;
  truePeakDb?: number;
}

const DEFAULT_AUDIO_TRACK_PROCESSING: AudioTrackProcessing = { gainDb: 0 };

function audioTrackLevelMode(processing: AudioTrackProcessing): "manual" | "normalized" {
  return processing.loudnessNormalization === undefined ? "manual" : "normalized";
}

function effectiveAudioTrackGainDb(processing: AudioTrackProcessing): number {
  return audioTrackLevelMode(processing) === "manual" ? processing.gainDb : 0;
}

function audioTrackNormalizationGainDb(
  normalization: LoudnessNormalization,
  analysis: AudioLoudnessAnalysis,
): number {
  if (analysis.integratedLufs === undefined) return 0;
  const { maxTruePeakDb, targetLufs } = loudnessNormalizationTargets(normalization);
  const targetGainDb = targetLufs - analysis.integratedLufs;
  return analysis.truePeakDb === undefined
    ? targetGainDb
    : Math.min(targetGainDb, maxTruePeakDb - analysis.truePeakDb);
}

function audioTrackActivityProcessingChanged(
  left: AudioTrackProcessing,
  right: AudioTrackProcessing,
): boolean {
  if (left.loudnessNormalization !== undefined || right.loudnessNormalization !== undefined) {
    return !sameLoudnessNormalization(left.loudnessNormalization, right.loudnessNormalization);
  }
  return left.gainDb !== right.gainDb;
}

function audioTrackLoudnessInputsKey(
  streamIndex: number,
  trim: { endMicros: number; startMicros: number },
  processing: AudioTrackProcessing,
): string {
  const upstreamProcessing = Object.fromEntries(
    Object.entries(processing)
      .filter(([key]) => key !== "gainDb" && key !== "loudnessNormalization")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return JSON.stringify([streamIndex, trim.startMicros, trim.endMicros, upstreamProcessing]);
}

function sameAudioTrackLoudnessInputs(
  left: AudioTrackProcessing,
  right: AudioTrackProcessing,
): boolean {
  return (
    audioTrackLoudnessInputsKey(0, { startMicros: 0, endMicros: 0 }, left) ===
    audioTrackLoudnessInputsKey(0, { startMicros: 0, endMicros: 0 }, right)
  );
}

function loudnessNormalizationTargets(normalization: LoudnessNormalization): {
  maxTruePeakDb: number;
  targetLufs: number;
} {
  if (typeof normalization === "object") {
    return {
      maxTruePeakDb: normalization.maxTruePeakDb,
      targetLufs: normalization.targetLufs,
    };
  }
  const targets = {
    webVideo: { maxTruePeakDb: -1, targetLufs: -14 },
    streaming: { maxTruePeakDb: -1.5, targetLufs: -16 },
    broadcast: { maxTruePeakDb: -2, targetLufs: -23 },
  } satisfies Record<LoudnessPreset, { maxTruePeakDb: number; targetLufs: number }>;

  return targets[normalization];
}

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
  AudioLoudnessAnalysis,
  CustomLoudnessNormalization,
  LoudnessNormalization,
  LoudnessPreset,
};
export {
  audioTrackActivityProcessingChanged,
  audioTrackLevelMode,
  audioTrackNormalizationGainDb,
  audioTrackLoudnessInputsKey,
  cloneAudioTrackProcessing,
  DEFAULT_AUDIO_TRACK_PROCESSING,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  effectiveAudioTrackGainDb,
  loudnessNormalizationTargets,
  sameAudioTrackPreviewProcessing,
  sameAudioTrackLoudnessInputs,
  sameAudioTrackProcessing,
};
