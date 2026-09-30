import {
  type AudioTrackSignalEffect,
  getAudioTrackSignalEffects,
  type LoudnessNormalization,
  type NoiseReductionPreset,
} from "@/domain/audio-processing";
import type { SourceRef } from "@/domain/source";

import type {
  AppError,
  AudioPreviewDescriptor,
  AudioStream,
  BinaryCapability,
  ChapterInfo,
  ExportProgress,
  ExportResult,
  FrameRate,
  LoudnessAnalysis,
  MediaCapabilities,
  MediaInfo,
  OptimizedExportPlan,
  OutputSelection,
  PreviewDescriptor,
  SilenceRange,
  SourceImportResult,
  ThumbnailDescriptor,
  VideoStream,
  WaveformResult,
} from "./media.types";

function normalizeAppError(error: unknown): AppError {
  const value = asRecord(error);
  if (value && typeof value.code === "string" && typeof value.message === "string") {
    return {
      code: value.code,
      message: value.message,
      diagnostics: optionalString(value.diagnostics),
    };
  }
  if (error instanceof Error) return { code: "internal", message: error.message };
  if (typeof error === "string") return { code: "internal", message: error };
  return { code: "internal", message: "An unexpected application error occurred." };
}

function parseSourceRef(value: unknown): SourceRef {
  const source = requireRecord(value, "source reference");
  const createdAtMicros = optionalInteger(source.createdAtMicros, "source creation time");
  const fileSizeBytes = optionalInteger(source.fileSizeBytes, "source file size");
  const updatedAtMicros = optionalInteger(source.updatedAtMicros, "source update time");

  if (fileSizeBytes !== undefined && fileSizeBytes < 0) {
    throw invalidResponse("source file size");
  }

  return {
    displayName: requireString(source.displayName, "display name"),
    sourcePath: requireString(source.sourcePath, "source path"),
    ...(createdAtMicros === undefined ? {} : { createdAtMicros }),
    ...(fileSizeBytes === undefined ? {} : { fileSizeBytes }),
    ...(updatedAtMicros === undefined ? {} : { updatedAtMicros }),
  };
}

function parseSourceRefs(value: unknown): SourceRef[] {
  return requireArray(value, "source references").map(parseSourceRef);
}

function parseSceneBoundaries(value: unknown): number[] {
  const boundaries = requireArray(value, "scene boundaries").map((entry) =>
    requireInteger(entry, "scene boundary"),
  );

  if (
    boundaries.some(
      (boundary, index) => boundary < 0 || (index > 0 && boundary <= boundaries[index - 1]!),
    )
  ) {
    throw invalidResponse("scene boundaries");
  }
  return boundaries;
}

function parseSilenceRanges(value: unknown): SilenceRange[] {
  const ranges = requireArray(value, "silence ranges").map((entry) => {
    const record = requireRecord(entry, "silence range");
    const startMicros = requireInteger(record.startMicros, "silence start");
    const endMicros = requireInteger(record.endMicros, "silence end");
    if (startMicros < 0 || endMicros <= startMicros) throw invalidResponse("silence range");
    return { startMicros, endMicros };
  });

  if (
    ranges.some((range, index) => index > 0 && range.startMicros < ranges[index - 1]!.endMicros)
  ) {
    throw invalidResponse("silence ranges");
  }
  return ranges;
}

function parseSourceImportResult(value: unknown): SourceImportResult | null {
  if (value === null) return null;
  if (Array.isArray(value)) {
    const sources = parseSourceRefs(value);
    return {
      acceptedFileCount: sources.length,
      directFileCount: sources.length,
      discoveredFileCount: 0,
      folderCount: 0,
      readErrorCount: 0,
      recursive: false,
      skippedFileCount: 0,
      sources,
      truncated: false,
    };
  }

  const result = requireRecord(value, "source import result");
  const truncationReason = optionalString(result.truncationReason);
  return {
    acceptedFileCount: requireInteger(result.acceptedFileCount, "accepted file count"),
    directFileCount: requireInteger(result.directFileCount, "direct file count"),
    discoveredFileCount: requireInteger(result.discoveredFileCount, "discovered file count"),
    folderCount: requireInteger(result.folderCount, "folder count"),
    readErrorCount: requireInteger(result.readErrorCount, "read error count"),
    recursive: requireBoolean(result.recursive, "recursive import flag"),
    skippedFileCount: requireInteger(result.skippedFileCount, "skipped file count"),
    sources: requireArray(result.sources, "imported sources").map(parseSourceRef),
    truncated: requireBoolean(result.truncated, "traversal truncation flag"),
    ...(truncationReason ? { truncationReason } : {}),
  };
}

function parseOutputSelection(value: unknown): OutputSelection {
  const output = requireRecord(value, "output selection");
  return {
    outputId: requireString(output.outputId, "output ID"),
    displayName: requireString(output.displayName, "output display name"),
    displayPath: requireString(output.displayPath, "output display path"),
  };
}

function parseExportProgress(value: unknown): ExportProgress {
  const progress = requireRecord(value, "export progress");
  const phase = progress.phase;
  if (phase !== "running" && phase !== "completed") {
    throw invalidResponse("export progress phase");
  }

  return {
    operationId: requireString(progress.operationId, "operation ID"),
    elapsedMicros: requireInteger(progress.elapsedMicros, "export elapsed time"),
    frame: optionalInteger(progress.frame, "export frame"),
    fps: optionalString(progress.fps),
    speed: optionalString(progress.speed),
    bitrate: optionalString(progress.bitrate),
    totalSize: optionalInteger(progress.totalSize, "export total size"),
    phase,
  };
}

function parseExportResult(value: unknown): ExportResult {
  const result = requireRecord(value, "export result");
  return {
    operationId: requireString(result.operationId, "operation ID"),
    displayName: requireString(result.displayName, "output display name"),
    displayPath: requireString(result.displayPath, "output display path"),
  };
}

function parseOptimizedExportPlan(value: unknown): OptimizedExportPlan {
  const plan = requireRecord(value, "optimized export plan");
  return {
    commandPreview: requireString(plan.commandPreview, "optimized command preview"),
  };
}

function parseLoudnessAnalysis(value: unknown): LoudnessAnalysis {
  const result = requireRecord(value, "loudness analysis");
  return {
    integratedLufs: optionalFiniteNumber(result.integratedLufs, "integrated loudness"),
    truePeakDb: optionalFiniteNumber(result.truePeakDb, "true peak"),
    inputLra: optionalFiniteNumber(result.inputLra, "input loudness range"),
    inputThreshold: optionalFiniteNumber(result.inputThreshold, "input loudness threshold"),
  };
}

function parseMediaCapabilities(value: unknown): MediaCapabilities {
  const capabilities = requireRecord(value, "media capabilities");
  return {
    ffmpeg: parseBinaryCapability(capabilities.ffmpeg),
    ffprobe: parseBinaryCapability(capabilities.ffprobe),
  };
}

function parseMediaInfo(value: unknown): MediaInfo {
  const media = requireRecord(value, "media metadata");
  return {
    formatName: requireString(media.formatName, "format name"),
    formatLongName: optionalString(media.formatLongName),
    durationMicros: requireInteger(media.durationMicros, "duration"),
    startTimeMicros: optionalInteger(media.startTimeMicros, "start time"),
    sizeBytes: optionalInteger(media.sizeBytes, "file size"),
    bitrate: optionalInteger(media.bitrate, "bitrate"),
    video: parseVideoStream(media.video),
    audioStreams: requireArray(media.audioStreams, "audio streams").map(parseAudioStream),
    chapters: requireArray(media.chapters, "chapters").map(parseChapter),
  };
}

function parsePreviewDescriptor(value: unknown): PreviewDescriptor {
  const preview = requireRecord(value, "preview descriptor");
  const kind = preview.kind;
  if (kind !== "source" && kind !== "proxy") {
    throw invalidResponse("preview kind");
  }

  return {
    mediaToken: requirePositiveInteger(preview.mediaToken, "preview media token"),
    url: requireString(preview.url, "preview URL"),
    kind,
  };
}

function parseThumbnailDescriptor(value: unknown): ThumbnailDescriptor {
  const thumbnail = requireRecord(value, "thumbnail descriptor");
  return {
    mediaToken: requirePositiveInteger(thumbnail.mediaToken, "thumbnail media token"),
    url: requireString(thumbnail.url, "thumbnail URL"),
  };
}

function parseAudioPreviewDescriptors(value: unknown): AudioPreviewDescriptor[] {
  return requireArray(value, "audio preview descriptors").map(parseAudioPreviewDescriptor);
}

function parseWaveformResults(value: unknown): WaveformResult[] {
  return requireArray(value, "waveform results").map(parseWaveformResult);
}

function parseBinaryCapability(value: unknown): BinaryCapability {
  const capability = requireRecord(value, "binary capability");
  if (typeof capability.available !== "boolean") {
    throw invalidResponse("binary capability");
  }

  return {
    available: capability.available,
    version: optionalString(capability.version),
    path: optionalString(capability.path),
    error: optionalString(capability.error),
  };
}

function parseAudioPreviewDescriptor(value: unknown): AudioPreviewDescriptor {
  const preview = requireRecord(value, "audio preview descriptor");
  const processing = requireRecord(preview.processing, "audio preview processing");
  const gainDb = optionalFiniteNumber(processing.gainDb, "audio preview gain");
  if (gainDb === undefined) throw invalidResponse("audio preview gain");
  const loudnessNormalization = parseLoudnessNormalization(processing.loudnessNormalization);
  const effects = parseAudioTrackSignalEffects(processing.effects);
  return {
    mediaToken: requirePositiveInteger(preview.mediaToken, "audio preview media token"),
    previewRevision: requirePositiveInteger(preview.previewRevision, "audio preview revision"),
    processing: {
      gainDb,
      ...(effects === undefined ? {} : { effects }),
      ...(loudnessNormalization === undefined ? {} : { loudnessNormalization }),
    },
    streamIndex: requireInteger(preview.streamIndex, "audio preview stream index"),
    url: requireString(preview.url, "audio preview URL"),
  };
}

function parseAudioTrackSignalEffects(value: unknown): AudioTrackSignalEffect[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw invalidResponse("audio preview effects");

  const effects = value.map((item): AudioTrackSignalEffect => {
    const effect = requireRecord(item, "audio preview effect");
    const stage = effect.stage;
    if (
      stage !== "cleanup" &&
      stage !== "dynamics" &&
      stage !== "levelPolicy" &&
      stage !== "finalProtection"
    ) {
      throw invalidResponse("audio preview effect stage");
    }

    if (effect.type === "highPass") {
      const cutoffHz = optionalFiniteNumber(effect.cutoffHz, "audio preview high-pass cutoff");
      if (cutoffHz === undefined || cutoffHz < 10 || cutoffHz > 20_000 || stage === "levelPolicy") {
        throw invalidResponse("audio preview high-pass effect");
      }
      return { cutoffHz, stage, type: "highPass" };
    }

    const preset = parseNoiseReduction(effect.preset);
    if (effect.type !== "noiseReduction" || preset === undefined || stage !== "cleanup") {
      throw invalidResponse("audio preview noise-reduction effect");
    }
    return { preset, stage, type: "noiseReduction" };
  });

  return getAudioTrackSignalEffects({ gainDb: 0, effects });
}

function parseNoiseReduction(value: unknown): NoiseReductionPreset | undefined {
  if (value === "light" || value === "medium" || value === "strong") return value;
  return undefined;
}

function parseLoudnessNormalization(value: unknown): LoudnessNormalization | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "webVideo" || value === "streaming" || value === "broadcast") return value;

  const custom = requireRecord(value, "audio preview loudness normalization");
  const targetLufs = optionalFiniteNumber(custom.targetLufs, "custom loudness target LUFS");
  const maxTruePeakDb = optionalFiniteNumber(custom.maxTruePeakDb, "custom maximum true peak");
  if (
    custom.mode !== "custom" ||
    targetLufs === undefined ||
    targetLufs < -36 ||
    targetLufs > -5 ||
    maxTruePeakDb === undefined ||
    maxTruePeakDb < -9 ||
    maxTruePeakDb > 0
  ) {
    throw invalidResponse("audio preview loudness normalization");
  }
  return { maxTruePeakDb, mode: "custom", targetLufs };
}

function parseWaveformResult(value: unknown): WaveformResult {
  const waveform = requireRecord(value, "waveform result");
  const common = {
    jobId: requireString(waveform.jobId, "waveform job ID"),
    streamIndex: requireInteger(waveform.streamIndex, "waveform stream index"),
    width: requirePositiveInteger(waveform.width, "waveform width"),
  };

  if (waveform.status === "ready") {
    return {
      ...common,
      status: "ready",
      hasSignal: optionalBoolean(waveform.hasSignal),
      url: requireString(waveform.url, "waveform URL"),
    };
  }
  if (waveform.status === "failed") {
    return {
      ...common,
      status: "failed",
      error: parseAppError(waveform.error, "waveform error"),
    };
  }
  throw invalidResponse("waveform status");
}

function parseAppError(value: unknown, label: string): AppError {
  const error = requireRecord(value, label);
  return {
    code: requireString(error.code, `${label} code`),
    message: requireString(error.message, `${label} message`),
    diagnostics: optionalString(error.diagnostics),
  };
}

function parseVideoStream(value: unknown): VideoStream {
  const video = requireRecord(value, "video stream");
  return {
    streamIndex: requireInteger(video.streamIndex, "video stream index"),
    codecName: requireString(video.codecName, "video codec"),
    width: requireInteger(video.width, "video width"),
    height: requireInteger(video.height, "video height"),
    codedWidth: optionalInteger(video.codedWidth, "coded width"),
    codedHeight: optionalInteger(video.codedHeight, "coded height"),
    sampleAspectRatio: optionalString(video.sampleAspectRatio),
    pixelFormat: optionalString(video.pixelFormat),
    colorSpace: optionalString(video.colorSpace),
    colorTransfer: optionalString(video.colorTransfer),
    colorPrimaries: optionalString(video.colorPrimaries),
    timeBase: optionalString(video.timeBase),
    averageFrameRate: optionalFrameRate(video.averageFrameRate),
    realFrameRate: optionalFrameRate(video.realFrameRate),
    rotationDegrees: optionalInteger(video.rotationDegrees, "rotation"),
  };
}

function parseAudioStream(value: unknown): AudioStream {
  const audio = requireRecord(value, "audio stream");
  if (typeof audio.isDefault !== "boolean") {
    throw invalidResponse("audio stream");
  }

  return {
    streamIndex: requireInteger(audio.streamIndex, "audio stream index"),
    codecName: requireString(audio.codecName, "audio codec"),
    channels: optionalInteger(audio.channels, "channel count"),
    channelLayout: optionalString(audio.channelLayout),
    sampleRateHz: optionalInteger(audio.sampleRateHz, "sample rate"),
    language: optionalString(audio.language),
    title: optionalString(audio.title),
    isDefault: audio.isDefault,
  };
}

function parseChapter(value: unknown): ChapterInfo {
  const chapter = requireRecord(value, "chapter");
  return {
    id: requireInteger(chapter.id, "chapter ID"),
    startMicros: requireInteger(chapter.startMicros, "chapter start"),
    endMicros: requireInteger(chapter.endMicros, "chapter end"),
    title: optionalString(chapter.title),
  };
}

function optionalFrameRate(value: unknown): FrameRate | undefined {
  if (value === undefined || value === null) return undefined;
  const rate = requireRecord(value, "frame rate");
  const numerator = requireInteger(rate.numerator, "frame-rate numerator");
  const denominator = requireInteger(rate.denominator, "frame-rate denominator");
  if (numerator <= 0 || denominator <= 0) {
    throw invalidResponse("frame rate");
  }

  return {
    numerator,
    denominator,
    displayValue: optionalFiniteNumber(rate.displayValue, "frame-rate display value"),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  const record = asRecord(value);
  if (!record) throw invalidResponse(label);
  return record;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw invalidResponse(label);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") throw invalidResponse(label);
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === "boolean" ? value : undefined;
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw invalidResponse(label);
  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw invalidResponse(label);
  return value;
}

function requirePositiveInteger(value: unknown, label: string): number {
  const integer = requireInteger(value, label);
  if (integer <= 0) throw invalidResponse(label);
  return integer;
}

function optionalInteger(value: unknown, label: string): number | undefined {
  return value === undefined || value === null ? undefined : requireInteger(value, label);
}

function optionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw invalidResponse(label);
  return value;
}

function invalidResponse(label: string): AppError {
  return {
    code: "internal",
    message: `The native application returned an invalid ${label}.`,
  };
}

export {
  normalizeAppError,
  parseAudioPreviewDescriptors,
  parseExportProgress,
  parseExportResult,
  parseLoudnessAnalysis,
  parseMediaCapabilities,
  parseMediaInfo,
  parseOptimizedExportPlan,
  parseOutputSelection,
  parsePreviewDescriptor,
  parseSceneBoundaries,
  parseSilenceRanges,
  parseSourceImportResult,
  parseSourceRef,
  parseSourceRefs,
  parseThumbnailDescriptor,
  parseWaveformResults,
};
