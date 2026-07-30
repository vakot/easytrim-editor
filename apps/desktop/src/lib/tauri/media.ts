import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppError {
  code: string;
  message: string;
  diagnostics?: string;
}

export interface SourceSelection {
  sourceId: string;
  displayName: string;
}

export interface BinaryCapability {
  available: boolean;
  version?: string;
  error?: string;
}

export interface MediaCapabilities {
  ffmpeg: BinaryCapability;
  ffprobe: BinaryCapability;
}

export interface FrameRate {
  numerator: number;
  denominator: number;
  displayValue?: number;
}

export interface VideoStream {
  streamIndex: number;
  codecName: string;
  width: number;
  height: number;
  codedWidth?: number;
  codedHeight?: number;
  sampleAspectRatio?: string;
  pixelFormat?: string;
  colorSpace?: string;
  colorTransfer?: string;
  colorPrimaries?: string;
  timeBase?: string;
  averageFrameRate?: FrameRate;
  realFrameRate?: FrameRate;
  rotationDegrees?: number;
}

export interface AudioStream {
  streamIndex: number;
  codecName: string;
  channels?: number;
  channelLayout?: string;
  sampleRateHz?: number;
  language?: string;
  title?: string;
  isDefault: boolean;
}

export interface ChapterInfo {
  id: number;
  startMicros: number;
  endMicros: number;
  title?: string;
}

export interface MediaInfo {
  sourceId: string;
  formatName: string;
  formatLongName?: string;
  durationMicros: number;
  startTimeMicros?: number;
  sizeBytes?: number;
  bitrate?: number;
  video: VideoStream;
  audioStreams: AudioStream[];
  chapters: ChapterInfo[];
}

export type SourceImportEvent =
  { status: "selected"; source: SourceSelection } | { status: "failed"; error: AppError };

export async function chooseSource(): Promise<SourceSelection | null> {
  try {
    const value = await invoke<unknown>("choose_source");
    return value === null ? null : parseSourceSelection(value);
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function checkMediaCapabilities(): Promise<MediaCapabilities> {
  try {
    return parseMediaCapabilities(await invoke<unknown>("check_media_capabilities"));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function inspectMedia(sourceId: string): Promise<MediaInfo> {
  try {
    return parseMediaInfo(await invoke<unknown>("inspect_media", { sourceId }));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function listenForSourceImports(
  onImport: (event: SourceImportEvent) => void,
): Promise<UnlistenFn> {
  return listen<unknown>("source-import", (event) => {
    try {
      onImport(parseSourceImportEvent(event.payload));
    } catch (error: unknown) {
      onImport({ status: "failed", error: normalizeAppError(error) });
    }
  });
}

export function normalizeAppError(error: unknown): AppError {
  const value = asRecord(error);
  if (value && typeof value.code === "string" && typeof value.message === "string") {
    return {
      code: value.code,
      message: value.message,
      diagnostics: optionalString(value.diagnostics),
    };
  }
  if (error instanceof Error) {
    return { code: "internal", message: error.message };
  }
  if (typeof error === "string") {
    return { code: "internal", message: error };
  }
  return { code: "internal", message: "An unexpected application error occurred." };
}

function parseSourceImportEvent(value: unknown): SourceImportEvent {
  const event = requireRecord(value, "source import event");
  if (event.status === "selected") {
    return { status: "selected", source: parseSourceSelection(event.source) };
  }
  if (event.status === "failed") {
    return { status: "failed", error: normalizeAppError(event.error) };
  }
  throw invalidResponse("source import event");
}

function parseSourceSelection(value: unknown): SourceSelection {
  const source = requireRecord(value, "source selection");
  return {
    sourceId: requireString(source.sourceId, "source ID"),
    displayName: requireString(source.displayName, "display name"),
  };
}

function parseMediaCapabilities(value: unknown): MediaCapabilities {
  const capabilities = requireRecord(value, "media capabilities");
  return {
    ffmpeg: parseBinaryCapability(capabilities.ffmpeg),
    ffprobe: parseBinaryCapability(capabilities.ffprobe),
  };
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

function parseMediaInfo(value: unknown): MediaInfo {
  const media = requireRecord(value, "media metadata");
  return {
    sourceId: requireString(media.sourceId, "source ID"),
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
  if (value === undefined || value === null) {
    return undefined;
  }
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
  if (!record) {
    throw invalidResponse(label);
  }
  return record;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw invalidResponse(label);
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw invalidResponse(label);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw invalidResponse(label);
  }
  return value;
}

function optionalInteger(value: unknown, label: string): number | undefined {
  return value === undefined || value === null ? undefined : requireInteger(value, label);
}

function optionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidResponse(label);
  }
  return value;
}

function invalidResponse(label: string): AppError {
  return {
    code: "internal",
    message: `The native application returned an invalid ${label}.`,
  };
}
