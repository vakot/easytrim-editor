type LoudnessPreset = "webVideo" | "streaming" | "broadcast";
const AUDIO_PROCESSING_STAGES = ["cleanup", "dynamics", "levelPolicy", "finalProtection"] as const;
// Keep in sync with AudioTrackSignalEffect ordering in media/export.rs.
const AUDIO_TRACK_SIGNAL_EFFECT_ORDER = ["highPass", "noiseReduction", "limiter"] as const;
const SINGLETON_AUDIO_TRACK_SIGNAL_EFFECTS = ["noiseReduction", "limiter"] as const;
type AudioProcessingStage = (typeof AUDIO_PROCESSING_STAGES)[number];
type AudioTrackSignalEffect =
  | {
      cutoffHz: number;
      stage: AudioProcessingStage;
      type: "highPass";
    }
  | {
      preset: NoiseReductionPreset;
      stage: "cleanup";
      type: "noiseReduction";
    }
  | {
      ceilingDb: number;
      stage: "finalProtection";
      type: "limiter";
    };

type NoiseReductionPreset = "light" | "medium" | "strong";

interface CustomLoudnessNormalization {
  maxTruePeakDb: number;
  mode: "custom";
  targetLufs: number;
}

type LoudnessNormalization = LoudnessPreset | CustomLoudnessNormalization;

interface AudioTrackProcessing {
  effects?: AudioTrackSignalEffect[];
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
const DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB = -1;

function audioTrackLevelMode(processing: AudioTrackProcessing): "manual" | "normalized" {
  return processing.loudnessNormalization === undefined ? "manual" : "normalized";
}

function effectiveAudioTrackGainDb(processing: AudioTrackProcessing): number {
  return audioTrackLevelMode(processing) === "manual" ? processing.gainDb : 0;
}

function audioTrackRequiresProcessedPreview(processing: AudioTrackProcessing): boolean {
  return processing.loudnessNormalization !== undefined || (processing.effects?.length ?? 0) > 0;
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
    audioTrackRequiresProcessedPreview(onlyTrack.processing) ||
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
  if (
    JSON.stringify(getAudioTrackSignalEffects(left)) !==
    JSON.stringify(getAudioTrackSignalEffects(right))
  ) {
    return true;
  }
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
  const effects = getAudioTrackPreLevelEffects(processing);
  return JSON.stringify([sourceKey, streamIndex, trim.startMicros, trim.endMicros, effects]);
}

function sameAudioTrackLoudnessInputs(
  left: AudioTrackProcessing,
  right: AudioTrackProcessing,
): boolean {
  return (
    JSON.stringify(getAudioTrackPreLevelEffects(left)) ===
    JSON.stringify(getAudioTrackPreLevelEffects(right))
  );
}

function getAudioTrackPreLevelEffects(processing: AudioTrackProcessing): AudioTrackSignalEffect[] {
  return getAudioTrackSignalEffects(processing).filter(
    (effect) => effect.stage === "cleanup" || effect.stage === "dynamics",
  );
}

function getAudioTrackSignalEffect<T extends AudioTrackSignalEffect["type"]>(
  processing: AudioTrackProcessing,
  type: T,
): Extract<AudioTrackSignalEffect, { type: T }> | undefined {
  return getAudioTrackSignalEffects(processing).find(
    (effect): effect is Extract<AudioTrackSignalEffect, { type: T }> => effect.type === type,
  );
}

function setAudioTrackSignalEffect(
  processing: AudioTrackProcessing,
  nextEffect: AudioTrackSignalEffect,
): AudioTrackProcessing {
  const isSingleton = (SINGLETON_AUDIO_TRACK_SIGNAL_EFFECTS as readonly string[]).includes(
    nextEffect.type,
  );

  const effects = getAudioTrackSignalEffects(processing).filter(
    (effect) =>
      effect.type !== nextEffect.type || (!isSingleton && effect.stage !== nextEffect.stage),
  );

  effects.push(nextEffect);

  return { ...processing, effects: getAudioTrackSignalEffects({ ...processing, effects }) };
}

function removeAudioTrackSignalEffect(
  processing: AudioTrackProcessing,
  type: AudioTrackSignalEffect["type"],
): AudioTrackProcessing {
  const effects = getAudioTrackSignalEffects(processing).filter((effect) => effect.type !== type);
  const nextProcessing = { ...processing };
  if (effects.length === 0) delete nextProcessing.effects;
  else nextProcessing.effects = effects;
  return nextProcessing;
}

function getAudioTrackSignalEffects(processing: AudioTrackProcessing): AudioTrackSignalEffect[] {
  return [...(processing.effects ?? [])].sort(compareAudioTrackSignalEffects);
}

function compareAudioTrackSignalEffects(
  left: AudioTrackSignalEffect,
  right: AudioTrackSignalEffect,
): number {
  const stageDifference =
    AUDIO_PROCESSING_STAGES.indexOf(left.stage) - AUDIO_PROCESSING_STAGES.indexOf(right.stage);

  if (stageDifference !== 0) return stageDifference;

  const typeDifference =
    AUDIO_TRACK_SIGNAL_EFFECT_ORDER.indexOf(left.type) -
    AUDIO_TRACK_SIGNAL_EFFECT_ORDER.indexOf(right.type);

  if (typeDifference !== 0) return typeDifference;

  if (left.type === "highPass" && right.type === "highPass") {
    return left.cutoffHz - right.cutoffHz;
  }
  if (left.type === "noiseReduction" && right.type === "noiseReduction") {
    return (
      ["light", "medium", "strong"].indexOf(left.preset) -
      ["light", "medium", "strong"].indexOf(right.preset)
    );
  }
  if (left.type === "limiter" && right.type === "limiter") {
    return left.ceilingDb - right.ceilingDb;
  }
  return 0;
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
    JSON.stringify(getAudioTrackSignalEffects(left)) ===
      JSON.stringify(getAudioTrackSignalEffects(right))
  );
}

function sameAudioTrackPreviewProcessing(
  left: AudioTrackProcessing,
  right: AudioTrackProcessing,
): boolean {
  return (
    sameLoudnessNormalization(left.loudnessNormalization, right.loudnessNormalization) &&
    JSON.stringify(getAudioTrackSignalEffects(left)) ===
      JSON.stringify(getAudioTrackSignalEffects(right))
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
    gainDb: processing.gainDb,
    ...(processing.effects === undefined
      ? {}
      : { effects: getAudioTrackSignalEffects(processing).map((effect) => ({ ...effect })) }),
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
  AudioTrackSignalEffect,
  CustomLoudnessNormalization,
  LoudnessNormalization,
  LoudnessPreset,
  NoiseReductionPreset,
};
export {
  AUDIO_PROCESSING_STAGES,
  AUDIO_TRACK_SIGNAL_EFFECT_ORDER,
  audioTrackActivityProcessingChanged,
  audioTrackExternalPreviewStreamIndexes,
  audioTrackLevelMode,
  audioTrackLoudnessInputsKey,
  audioTrackNormalizationGainDb,
  audioTrackRequiresProcessedPreview,
  cloneAudioTrackProcessing,
  DEFAULT_AUDIO_TRACK_LIMITER_CEILING_DB,
  DEFAULT_AUDIO_TRACK_PROCESSING,
  DEFAULT_CUSTOM_LOUDNESS_NORMALIZATION,
  effectiveAudioTrackGainDb,
  getAudioTrackSignalEffect,
  getAudioTrackSignalEffects,
  loudnessNormalizationTargets,
  removeAudioTrackSignalEffect,
  sameAudioTrackLoudnessInputs,
  sameAudioTrackPreviewProcessing,
  sameAudioTrackProcessing,
  sameLoudnessNormalization,
  setAudioTrackSignalEffect,
  SINGLETON_AUDIO_TRACK_SIGNAL_EFFECTS,
};
