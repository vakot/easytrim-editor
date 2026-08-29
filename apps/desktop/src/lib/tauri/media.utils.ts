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
  MediaCapabilities,
  MediaInfo,
  OptimizedExportPlan,
  OutputSelection,
  PreviewDescriptor,
  VideoStream,
  WaveformResult,
} from "./media.types";

export function normalizeAppError(error: unknown): AppError {
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

export function parseSourceRef(value: unknown): SourceRef {
  const source = requireRecord(value, "source reference");
  return {
    displayName: requireString(source.displayName, "display name"),
    sourcePath: requireString(source.sourcePath, "source path"),
  };
}

export function parseSourceRefs(value: unknown): SourceRef[] {
  return requireArray(value, "source references").map(parseSourceRef);
}

export function parseOutputSelection(value: unknown): OutputSelection {
  const output = requireRecord(value, "output selection");
  return {
    outputId: requireString(output.outputId, "output ID"),
    displayName: requireString(output.displayName, "output display name"),
    displayPath: requireString(output.displayPath, "output display path"),
  };
}

export function parseExportProgress(value: unknown): ExportProgress {
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

export function parseExportResult(value: unknown): ExportResult {
  const result = requireRecord(value, "export result");
  return {
    operationId: requireString(result.operationId, "operation ID"),
    displayName: requireString(result.displayName, "output display name"),
    displayPath: requireString(result.displayPath, "output display path"),
  };
}

export function parseOptimizedExportPlan(value: unknown): OptimizedExportPlan {
  const plan = requireRecord(value, "optimized export plan");
  return {
    commandPreview: requireString(plan.commandPreview, "optimized command preview"),
  };
}

export function parseMediaCapabilities(value: unknown): MediaCapabilities {
  const capabilities = requireRecord(value, "media capabilities");
  return {
    ffmpeg: parseBinaryCapability(capabilities.ffmpeg),
    ffprobe: parseBinaryCapability(capabilities.ffprobe),
  };
}

export function parseMediaInfo(value: unknown): MediaInfo {
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

export function parsePreviewDescriptor(value: unknown): PreviewDescriptor {
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

export function parseAudioPreviewDescriptors(value: unknown): AudioPreviewDescriptor[] {
  return requireArray(value, "audio preview descriptors").map(parseAudioPreviewDescriptor);
}

export function parseWaveformResults(value: unknown): WaveformResult[] {
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
    error: optionalString(capability.error),
  };
}

function parseAudioPreviewDescriptor(value: unknown): AudioPreviewDescriptor {
  const preview = requireRecord(value, "audio preview descriptor");
  return {
    mediaToken: requirePositiveInteger(preview.mediaToken, "audio preview media token"),
    streamIndex: requireInteger(preview.streamIndex, "audio preview stream index"),
    url: requireString(preview.url, "audio preview URL"),
  };
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
