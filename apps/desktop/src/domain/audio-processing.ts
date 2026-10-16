import { normalizeMetadataLanguageCode } from "./languages";

// Keep types, parameters, and ranges in sync with media/audio_filters/model.rs.
const AUDIO_FILTER_TYPES = [
  "highPass",
  "noiseReduction",
  "limiter",
  "loudnessNormalization",
  "gain",
] as const;

type AudioFilterType = (typeof AUDIO_FILTER_TYPES)[number];

interface HighPassFilter {
  cutoffHz: number;
  id: string;
  type: "highPass";
}

interface NoiseReductionFilter {
  id: string;
  noiseFloorDb: number;
  reductionDb: number;
  type: "noiseReduction";
}

interface LimiterFilter {
  attackMs: number;
  ceilingDb: number;
  id: string;
  releaseMs: number;
  type: "limiter";
}

interface LoudnessNormalizationFilter {
  id: string;
  loudnessRangeLu: number;
  maxTruePeakDb: number;
  targetLufs: number;
  type: "loudnessNormalization";
}

interface GainFilter {
  gainDb: number;
  id: string;
  type: "gain";
}

/** One active instance in a track's ordered chain; array order is execution order. */
type AudioFilter =
  GainFilter | HighPassFilter | LimiterFilter | LoudnessNormalizationFilter | NoiseReductionFilter;

type AudioFilterOfType<T extends AudioFilterType> = Extract<AudioFilter, { type: T }>;
type AudioFilterParameters<T extends AudioFilterType> = Omit<AudioFilterOfType<T>, "id" | "type">;

interface AudioParameterRange {
  max: number;
  min: number;
}

const AUDIO_FILTER_PARAMETER_RANGES = {
  highPass: { cutoffHz: { min: 10, max: 20_000 } },
  noiseReduction: {
    reductionDb: { min: 0.01, max: 97 },
    noiseFloorDb: { min: -80, max: -20 },
  },
  limiter: {
    ceilingDb: { min: -24, max: 0 },
    attackMs: { min: 0.1, max: 80 },
    releaseMs: { min: 1, max: 8_000 },
  },
  loudnessNormalization: {
    targetLufs: { min: -36, max: -5 },
    maxTruePeakDb: { min: -9, max: 0 },
    loudnessRangeLu: { min: 1, max: 50 },
  },
  gain: { gainDb: { min: -60, max: 24 } },
} as const satisfies {
  [T in AudioFilterType]: Record<keyof AudioFilterParameters<T>, AudioParameterRange>;
};

const MAX_AUDIO_FILTERS = 32;
const MAX_AUDIO_FILTER_ID_LENGTH = 64;

/** Track Volume is a linear amplitude multiplier applied after the filter chain. */
const DEFAULT_TRACK_VOLUME = 1;
const MAX_TRACK_VOLUME = 5;
const TRACK_VOLUME_SLIDER_MAX = 2;

interface AudioTrackProcessing {
  filters: AudioFilter[];
  volume: number;
}

interface AudioTrackMetadata {
  isDefault?: boolean;
  language?: string;
  title?: string;
}

interface AudioTrackSettings {
  enabled: boolean;
  metadata: AudioTrackMetadata;
  processing: AudioTrackProcessing;
  streamIndex: number;
}

interface AudioLoudnessAnalysis {
  inputLra?: number;
  inputThreshold?: number;
  integratedLufs?: number;
  truePeakDb?: number;
}

/** The loudness of the exact signal that reaches one normalization instance. */
interface AudioFilterMeasurement extends AudioLoudnessAnalysis {
  filterId: string;
}

/** A track's filter chain without Track Volume, as analysis, activity, and playback need it. */
interface AudioChainSelection {
  filters: AudioFilter[];
  loudnessMeasurements?: AudioFilterMeasurement[];
  streamIndex: number;
}

/** An exported track: its filter chain followed by Track Volume. */
interface AudioTrackSelection extends AudioChainSelection {
  volume: number;
}

function createDefaultAudioTrackProcessing(): AudioTrackProcessing {
  return { filters: [], volume: DEFAULT_TRACK_VOLUME };
}

function audioFilterParameterNames<T extends AudioFilterType>(
  type: T,
): (keyof AudioFilterParameters<T>)[] {
  return Object.keys(AUDIO_FILTER_PARAMETER_RANGES[type]) as (keyof AudioFilterParameters<T>)[];
}

function audioFilterParameterRange<T extends AudioFilterType>(
  type: T,
  parameter: keyof AudioFilterParameters<T>,
): AudioParameterRange {
  return (AUDIO_FILTER_PARAMETER_RANGES[type] as Record<string, AudioParameterRange>)[
    parameter as string
  ]!;
}

function isAudioFilterParameterValid<T extends AudioFilterType>(
  type: T,
  parameter: keyof AudioFilterParameters<T>,
  value: number,
): boolean {
  const range = audioFilterParameterRange(type, parameter);
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

function audioFilterParameterValue(filter: AudioFilter, parameter: PropertyKey): number {
  return (filter as unknown as Record<PropertyKey, number>)[parameter]!;
}

function isAudioFilterValid(filter: AudioFilter): boolean {
  return audioFilterParameterNames(filter.type).every((parameter) =>
    isAudioFilterParameterValid(
      filter.type,
      parameter,
      audioFilterParameterValue(filter, parameter),
    ),
  );
}

function isValidAudioFilterId(id: string): boolean {
  return id.length > 0 && id.length <= MAX_AUDIO_FILTER_ID_LENGTH && /^[A-Za-z0-9_-]+$/.test(id);
}

/** Mirrors the native chain validation so an invalid draft is never committed. */
function areAudioFiltersValid(filters: readonly AudioFilter[]): boolean {
  if (filters.length > MAX_AUDIO_FILTERS) return false;
  const ids = new Set<string>();
  for (const filter of filters) {
    if (!isValidAudioFilterId(filter.id) || ids.has(filter.id) || !isAudioFilterValid(filter)) {
      return false;
    }
    ids.add(filter.id);
  }
  return true;
}

function isTrackVolumeValid(volume: number): boolean {
  return Number.isFinite(volume) && volume >= 0 && volume <= MAX_TRACK_VOLUME;
}

function clampTrackVolume(volume: number): number {
  return Math.max(0, Math.min(MAX_TRACK_VOLUME, volume));
}

/** Parses a persisted chain strictly; any unknown type or invalid value rejects the chain. */
function parseAudioFilters(value: unknown): AudioFilter[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filters: AudioFilter[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      return undefined;
    }
    const record = candidate as Record<string, unknown>;
    const type = record.type;
    if (typeof record.id !== "string" || !isAudioFilterType(type)) return undefined;
    const filter: Record<string, unknown> = { id: record.id, type };
    for (const parameter of audioFilterParameterNames(type)) {
      const parameterValue = record[parameter as string];
      if (typeof parameterValue !== "number") return undefined;
      filter[parameter as string] = parameterValue;
    }
    filters.push(filter as unknown as AudioFilter);
  }
  return areAudioFiltersValid(filters) ? filters : undefined;
}

function parseAudioTrackProcessing(value: unknown): AudioTrackProcessing | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const filters = parseAudioFilters(record.filters);
  if (!filters || typeof record.volume !== "number" || !isTrackVolumeValid(record.volume)) {
    return undefined;
  }
  return { filters, volume: record.volume };
}

function isAudioFilterType(value: unknown): value is AudioFilterType {
  return (AUDIO_FILTER_TYPES as readonly unknown[]).includes(value);
}

function requiresLoudnessAnalysis(filter: AudioFilter): filter is LoudnessNormalizationFilter {
  return filter.type === "loudnessNormalization";
}

function audioFiltersRequireLoudnessAnalysis(filters: readonly AudioFilter[]): boolean {
  return filters.some(requiresLoudnessAnalysis);
}

/** A stable serialization independent of object key order. */
function audioFilterKey(filter: AudioFilter): unknown[] {
  return [
    filter.type,
    filter.id,
    ...audioFilterParameterNames(filter.type).map((parameter) =>
      audioFilterParameterValue(filter, parameter),
    ),
  ];
}

function sameAudioFilters(left: readonly AudioFilter[], right: readonly AudioFilter[]): boolean {
  return JSON.stringify(left.map(audioFilterKey)) === JSON.stringify(right.map(audioFilterKey));
}

/**
 * Identifies the measurements a chain needs: everything up to the last normalization instance.
 * That instance's own targets do not affect any measurement, so only its identity is included.
 * Downstream filters never affect it.
 */
function loudnessInputFilters(filters: readonly AudioFilter[]): unknown[] | null {
  let lastIndex = filters.length - 1;
  while (lastIndex >= 0 && !requiresLoudnessAnalysis(filters[lastIndex]!)) lastIndex -= 1;
  if (lastIndex === -1) return null;
  return filters
    .slice(0, lastIndex + 1)
    .map((filter, index) =>
      index === lastIndex ? [filter.type, filter.id] : audioFilterKey(filter),
    );
}

function audioTrackLoudnessInputsKey(
  sourceKey: string,
  streamIndex: number,
  trim: { endMicros: number; startMicros: number },
  filters: readonly AudioFilter[],
): string | null {
  const inputs = loudnessInputFilters(filters);
  return inputs === null
    ? null
    : JSON.stringify([sourceKey, streamIndex, trim.startMicros, trim.endMicros, inputs]);
}

function sameLoudnessInputs(left: readonly AudioFilter[], right: readonly AudioFilter[]): boolean {
  return JSON.stringify(loudnessInputFilters(left)) === JSON.stringify(loudnessInputFilters(right));
}

/**
 * Waveforms show the source after the chain's leading shaping filters. Everything from the first
 * level-dependent filter onward is excluded until waveforms are generated from processed PCM.
 */
function waveformShapeFilters(filters: readonly AudioFilter[]): AudioFilter[] {
  const shapeEnd = filters.findIndex(
    (filter) => filter.type !== "highPass" && filter.type !== "noiseReduction",
  );

  return filters.slice(0, shapeEnd === -1 ? filters.length : shapeEnd);
}

function cloneAudioTrackProcessing(processing: AudioTrackProcessing): AudioTrackProcessing {
  return {
    filters: processing.filters.map((filter) => ({ ...filter })),
    volume: processing.volume,
  };
}

function serializeAudioTrackSettings<T extends AudioTrackSettings>(track: T): AudioTrackSettings {
  const language = normalizeMetadataLanguageCode(track.metadata.language);

  return {
    enabled: track.enabled,
    metadata: {
      ...(track.metadata.isDefault === undefined ? {} : { isDefault: track.metadata.isDefault }),
      ...(track.metadata.title === undefined || track.metadata.title === ""
        ? {}
        : { title: track.metadata.title }),
      ...(language === undefined ? {} : { language }),
    },
    streamIndex: track.streamIndex,
    processing: cloneAudioTrackProcessing(track.processing),
  };
}

function normalizeAudioTrackDefaults<T extends AudioTrackSettings>(tracks: T[]): T[] {
  const defaultStreamIndex =
    tracks.find((track) => track.enabled && track.metadata.isDefault)?.streamIndex ??
    tracks.find((track) => track.enabled)?.streamIndex;

  return tracks.map((track) => ({
    ...track,
    metadata: {
      ...track.metadata,
      isDefault: track.enabled && track.streamIndex === defaultStreamIndex,
    },
  }));
}

export type {
  AudioChainSelection,
  AudioFilter,
  AudioFilterMeasurement,
  AudioFilterOfType,
  AudioFilterParameters,
  AudioFilterType,
  AudioLoudnessAnalysis,
  AudioParameterRange,
  AudioTrackMetadata,
  AudioTrackProcessing,
  AudioTrackSelection,
  AudioTrackSettings,
  LoudnessNormalizationFilter,
};
export {
  areAudioFiltersValid,
  AUDIO_FILTER_TYPES,
  audioFilterParameterNames,
  audioFilterParameterRange,
  audioFilterParameterValue,
  audioFiltersRequireLoudnessAnalysis,
  audioTrackLoudnessInputsKey,
  clampTrackVolume,
  cloneAudioTrackProcessing,
  createDefaultAudioTrackProcessing,
  DEFAULT_TRACK_VOLUME,
  isAudioFilterParameterValid,
  isTrackVolumeValid,
  MAX_AUDIO_FILTERS,
  MAX_TRACK_VOLUME,
  normalizeAudioTrackDefaults,
  parseAudioFilters,
  parseAudioTrackProcessing,
  sameAudioFilters,
  sameLoudnessInputs,
  serializeAudioTrackSettings,
  TRACK_VOLUME_SLIDER_MAX,
  waveformShapeFilters,
};
