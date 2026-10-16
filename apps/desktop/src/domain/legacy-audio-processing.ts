import {
  type AudioFilter,
  type AudioFilterMeasurement,
  type AudioTrackProcessing,
  type AudioTrackSelection,
  MAX_TRACK_VOLUME,
  parseAudioFilters,
  parseAudioTrackProcessing,
} from "./audio-processing";

/*
 * Migrates the stage-based processing model saved before ordered filter chains:
 * `{ gainDb, loudnessNormalization?, effects?: [{ type, stage, ... }] }`.
 *
 * Effects keep the order the stage model executed them in. Manual gain becomes Track Volume when
 * that is audibly identical, which holds whenever no Limiter followed it (gain commutes with the
 * linear High Pass). Gain that fed a Limiter stays a Gain filter at its original position, because
 * moving it after the Limiter would change what is limited. Gain above the 500% Track Volume limit
 * keeps the excess as a trailing Gain filter instead of losing level. Gain that normalization made
 * dormant is dropped, as it never reached the output.
 */

const LEGACY_STAGES = ["cleanup", "dynamics", "levelPolicy", "finalProtection"] as const;
const LEGACY_EFFECT_TYPES = ["highPass", "noiseReduction", "limiter"] as const;
const LEGACY_NOISE_REDUCTION = {
  light: { reductionDb: 6, noiseFloorDb: -40 },
  medium: { reductionDb: 12, noiseFloorDb: -35 },
  strong: { reductionDb: 20, noiseFloorDb: -30 },
} as const;

const LEGACY_LOUDNESS_PRESETS = {
  webVideo: { targetLufs: -14, maxTruePeakDb: -1 },
  streaming: { targetLufs: -16, maxTruePeakDb: -1.5 },
  broadcast: { targetLufs: -23, maxTruePeakDb: -2 },
} as const;

const LEGACY_LOUDNESS_RANGE_LU = 11;
const LEGACY_LIMITER_TIMING = { attackMs: 5, releaseMs: 50 } as const;
// The legacy gain input accepted -60..24 dB.
const LEGACY_GAIN_RANGE = { min: -60, max: 24 } as const;

type LegacyStage = (typeof LEGACY_STAGES)[number];
type UnidentifiedFilter = AudioFilter extends infer F
  ? F extends AudioFilter
    ? Omit<F, "id">
    : never
  : never;

interface LegacyEffect {
  filter: UnidentifiedFilter;
  sortValue: number;
  stage: LegacyStage;
  typeOrder: number;
}

interface MigratedAudioTrackProcessing {
  /** The normalization instance that a legacy single loudness measurement belongs to. */
  normalizationFilterId?: string;
  processing: AudioTrackProcessing;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Accepts the current model unchanged and converts the stage-based model. */
function migrateAudioTrackProcessing(value: unknown): MigratedAudioTrackProcessing | undefined {
  const current = parseAudioTrackProcessing(value);
  if (current) return { processing: current };
  if (!isRecord(value) || !isFiniteNumber(value.gainDb)) return undefined;

  const effects = parseLegacyEffects(value.effects);
  const normalization = parseLegacyNormalization(value.loudnessNormalization);
  if (!effects || normalization === null) return undefined;

  const preLevel = effects.filter((effect) => effect.stage !== "finalProtection");
  const finalProtection = effects.filter((effect) => effect.stage === "finalProtection");
  const gainDb = Math.max(LEGACY_GAIN_RANGE.min, Math.min(LEGACY_GAIN_RANGE.max, value.gainDb));
  const chain: UnidentifiedFilter[] = preLevel.map((effect) => effect.filter);
  const trailing: UnidentifiedFilter[] = [];
  let volume = 1;

  if (normalization) {
    chain.push(normalization);
  } else if (gainDb !== 0) {
    if (finalProtection.some((effect) => effect.filter.type === "limiter")) {
      chain.push({ gainDb, type: "gain" });
    } else {
      volume = Math.min(10 ** (gainDb / 20), MAX_TRACK_VOLUME);
      const remainingGainDb = gainDb - 20 * Math.log10(volume);
      if (remainingGainDb > 1e-9) trailing.push({ gainDb: remainingGainDb, type: "gain" });
    }
  }
  chain.push(...finalProtection.map((effect) => effect.filter), ...trailing);

  const filters = chain.map((filter, index) => ({ ...filter, id: `legacy-${index + 1}` }));
  const parsedFilters = parseAudioFilters(filters);
  if (!parsedFilters) return undefined;
  const normalizationFilterId = parsedFilters.find(
    (filter) => filter.type === "loudnessNormalization",
  )?.id;

  return {
    ...(normalizationFilterId === undefined ? {} : { normalizationFilterId }),
    processing: { filters: parsedFilters, volume },
  };
}

/**
 * Converts a stored export request track. A legacy request carried one measurement for its single
 * normalization; it now belongs to that instance's identifier.
 */
function migrateAudioTrackSelection(value: unknown): AudioTrackSelection | undefined {
  if (!isRecord(value) || !Number.isSafeInteger(value.streamIndex)) return undefined;
  const streamIndex = value.streamIndex as number;
  if (!("processing" in value)) {
    const processing = parseAudioTrackProcessing(value);
    if (!processing) return undefined;
    return {
      ...processing,
      ...(Array.isArray(value.loudnessMeasurements)
        ? { loudnessMeasurements: value.loudnessMeasurements as AudioFilterMeasurement[] }
        : {}),
      streamIndex,
    };
  }

  const migrated = migrateAudioTrackProcessing(value.processing);
  if (!migrated) return undefined;
  const measurement =
    migrated.normalizationFilterId !== undefined && isRecord(value.loudnessAnalysis)
      ? { ...value.loudnessAnalysis, filterId: migrated.normalizationFilterId }
      : undefined;

  return {
    ...migrated.processing,
    ...(measurement ? { loudnessMeasurements: [measurement as AudioFilterMeasurement] } : {}),
    streamIndex,
  };
}

function parseLegacyEffects(value: unknown): LegacyEffect[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  const effects: LegacyEffect[] = [];
  const highPassStages = new Set<LegacyStage>();
  for (const candidate of value) {
    if (!isRecord(candidate)) return undefined;
    const effect = parseLegacyEffect(candidate);
    if (!effect) return undefined;
    if (effect.filter.type === "highPass") {
      if (highPassStages.has(effect.stage)) return undefined;
      highPassStages.add(effect.stage);
    } else if (effects.some((existing) => existing.filter.type === effect.filter.type)) {
      return undefined;
    }
    effects.push(effect);
  }
  return effects.sort(
    (left, right) =>
      LEGACY_STAGES.indexOf(left.stage) - LEGACY_STAGES.indexOf(right.stage) ||
      left.typeOrder - right.typeOrder ||
      left.sortValue - right.sortValue,
  );
}

function parseLegacyEffect(effect: Record<string, unknown>): LegacyEffect | undefined {
  const typeOrder = LEGACY_EFFECT_TYPES.indexOf(effect.type as never);
  if (effect.type === "highPass") {
    if (
      (effect.stage !== "cleanup" &&
        effect.stage !== "dynamics" &&
        effect.stage !== "finalProtection") ||
      !isFiniteNumber(effect.cutoffHz)
    ) {
      return undefined;
    }
    return {
      filter: { cutoffHz: effect.cutoffHz, type: "highPass" },
      sortValue: effect.cutoffHz,
      stage: effect.stage,
      typeOrder,
    };
  }
  if (effect.type === "noiseReduction") {
    const preset = effect.preset;
    if (
      effect.stage !== "cleanup" ||
      (preset !== "light" && preset !== "medium" && preset !== "strong")
    ) {
      return undefined;
    }
    return {
      filter: { ...LEGACY_NOISE_REDUCTION[preset], type: "noiseReduction" },
      sortValue: 0,
      stage: "cleanup",
      typeOrder,
    };
  }
  if (effect.type === "limiter") {
    if (effect.stage !== "finalProtection" || !isFiniteNumber(effect.ceilingDb)) return undefined;
    return {
      filter: { ceilingDb: effect.ceilingDb, ...LEGACY_LIMITER_TIMING, type: "limiter" },
      sortValue: effect.ceilingDb,
      stage: "finalProtection",
      typeOrder,
    };
  }
  return undefined;
}

/** `undefined` means no normalization; `null` means an invalid value. */
function parseLegacyNormalization(value: unknown): UnidentifiedFilter | undefined | null {
  if (value === undefined) return undefined;
  const targets =
    typeof value === "string" && value in LEGACY_LOUDNESS_PRESETS
      ? LEGACY_LOUDNESS_PRESETS[value as keyof typeof LEGACY_LOUDNESS_PRESETS]
      : isRecord(value) &&
          value.mode === "custom" &&
          isFiniteNumber(value.targetLufs) &&
          isFiniteNumber(value.maxTruePeakDb)
        ? { maxTruePeakDb: value.maxTruePeakDb, targetLufs: value.targetLufs }
        : null;

  return targets === null
    ? null
    : { ...targets, loudnessRangeLu: LEGACY_LOUDNESS_RANGE_LU, type: "loudnessNormalization" };
}

export { migrateAudioTrackProcessing, migrateAudioTrackSelection };
