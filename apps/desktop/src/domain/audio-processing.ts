type LoudnessPreset = "webVideo" | "streaming" | "broadcast";
type AudioProcessingStage = "cleanup" | "dynamics" | "levelPolicy" | "finalProtection";

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
  inputLra?: number;
  inputThreshold?: number;
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

function audioTrackExternalPreviewStreamIndexes(
  tracks: AudioTrackSettings[],
  nativeAudioStreamIndex: number | undefined,
): number[] {
  const enabledTracks = tracks.filter((track) => track.enabled);
  if (enabledTracks.length > 1) return enabledTracks.map((track) => track.streamIndex);

  const onlyTrack = enabledTracks[0];
  if (!onlyTrack) return [];
  if (
    onlyTrack.processing.loudnessNormalization !== undefined ||
    onlyTrack.streamIndex !== nativeAudioStreamIndex
  ) {
    return [onlyTrack.streamIndex];
  }
  return [];
}

function audioTrackNormalizationGainDb(
  normalization: LoudnessNormalization,
  analysis: AudioLoudnessAnalysis,
): number {
  // Presentation-only waveform estimate. Preview/export use FFmpeg loudnorm.
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
  if (!sameAudioTrackLoudnessInputs(left, right)) return true;
  if (left.loudnessNormalization !== undefined || right.loudnessNormalization !== undefined) {
    return !sameLoudnessNormalization(left.loudnessNormalization, right.loudnessNormalization);
  }
  return left.gainDb !== right.gainDb;
}

function audioTrackLoudnessInputsKey(
  sourceKey: string,
  streamIndex: number,
  trim: { endMicros: number; startMicros: number },
  processing: AudioTrackProcessing,
): string {
  const upstreamEffectInputs = getUpstreamAudioEffectInputs(processing);
  return JSON.stringify([
    sourceKey,
    streamIndex,
    trim.startMicros,
    trim.endMicros,
    upstreamEffectInputs,
  ]);
}

function sameAudioTrackLoudnessInputs(
  left: AudioTrackProcessing,
  right: AudioTrackProcessing,
): boolean {
  return (
    JSON.stringify(getUpstreamAudioEffectInputs(left)) ===
    JSON.stringify(getUpstreamAudioEffectInputs(right))
  );
}

function getUpstreamAudioEffectInputs(processing: AudioTrackProcessing): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(processing)
      .filter(([key]) => key !== "gainDb" && key !== "loudnessNormalization")
      .sort(([left], [right]) => left.localeCompare(right)),
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
    sameLoudnessNormalization(left.loudnessNormalization, right.loudnessNormalization) &&
    sameAudioTrackLoudnessInputs(left, right)
  );
}

function sameAudioTrackPreviewProcessing(
  left: AudioTrackProcessing,
  right: AudioTrackProcessing,
): boolean {
  return (
    sameLoudnessNormalization(left.loudnessNormalization, right.loudnessNormalization) &&
    sameAudioTrackLoudnessInputs(left, right)
  );
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
    ...getUpstreamAudioEffectInputs(processing),
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
  AudioLoudnessAnalysis,
  AudioProcessingStage,
  AudioTrackProcessing,
  AudioTrackSelection,
  AudioTrackSettings,
  CustomLoudnessNormalization,
  LoudnessNormalization,
  LoudnessPreset,
};
export {
  audioTrackActivityProcessingChanged,
  audioTrackExternalPreviewStreamIndexes,
  audioTrackLevelMode,
  audioTrackLoudnessInputsKey,
  audioTrackNormalizationGainDb,
  cloneAudioTrackProcessing,
  DEFAULT_AUDIO_TRACK_PROCESSING,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  effectiveAudioTrackGainDb,
  loudnessNormalizationTargets,
  sameAudioTrackLoudnessInputs,
  sameAudioTrackPreviewProcessing,
  sameAudioTrackProcessing,
  sameLoudnessNormalization,
};
