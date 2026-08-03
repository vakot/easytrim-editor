import { Channel, invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export interface AppError {
  code: string;
  message: string;
  diagnostics?: string;
}

export interface SourceSelection {
  sourceId: string;
  displayName: string;
}

export interface TrimSelection {
  startMicros: number;
  endMicros: number;
}

export interface ExportProgress {
  operationId: string;
  elapsedMicros: number;
  speed?: string;
  phase: "running" | "completed";
}

export interface OutputSelection {
  outputId: string;
  displayName: string;
  displayPath: string;
}

export interface ExportResult {
  operationId: string;
  displayName: string;
  displayPath: string;
}

export interface FastExportRequest {
  sourceId: string;
  trim: TrimSelection;
  audioTracks: AudioTrackSelection[];
  mergeAudio: boolean;
}

export interface AudioTrackSelection {
  streamIndex: number;
  volumePercent: number;
}

export interface OptimizedExportRequest extends FastExportRequest {
  resolution: { width: number; height: number };
  frameRate?: { numerator: number; denominator: number };
  arguments: string;
}

export interface OptimizedExportPlan {
  commandPreview: string;
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

export type PreviewKind = "source" | "proxy";

export interface PreviewDescriptor {
  sourceId: string;
  url: string;
  kind: PreviewKind;
}

export interface AudioPreviewDescriptor {
  sourceId: string;
  streamIndex: number;
  url: string;
}

export type WaveformResult =
  | {
      status: "ready";
      sourceId: string;
      jobId: string;
      streamIndex: number;
      width: number;
      hasSignal?: boolean;
      url: string;
    }
  | {
      status: "failed";
      sourceId: string;
      jobId: string;
      streamIndex: number;
      width: number;
      error: AppError;
    };

export type SourceImportEvent =
  { status: "selected"; source: SourceSelection } | { status: "failed"; error: AppError };

export type SourceDropEvent = { status: "drag"; active: boolean } | SourceImportEvent;

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

export async function chooseOutputPath(defaultName: string): Promise<OutputSelection | null> {
  try {
    const value = await invoke<unknown>("choose_output_path", { defaultName });
    return value === null ? null : parseOutputSelection(value);
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function renderFast(
  request: FastExportRequest,
  outputId: string,
  onProgress: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  return render("render_fast", request, outputId, onProgress);
}

export async function renderOptimized(
  request: OptimizedExportRequest,
  outputId: string,
  onProgress: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  return render("render_optimized", request, outputId, onProgress);
}

export async function planOptimizedExport(
  request: OptimizedExportRequest,
): Promise<OptimizedExportPlan> {
  try {
    return parseOptimizedExportPlan(await invoke<unknown>("plan_optimized_export", { request }));
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function cancelOperation(operationId: string): Promise<void> {
  try {
    await invoke("cancel_operation", { operationId });
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function openFileLocation(path: string): Promise<void> {
  try {
    await invoke("open_file_location", { path });
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

async function render(
  command: "render_fast" | "render_optimized",
  request: FastExportRequest | OptimizedExportRequest,
  outputId: string,
  onProgress: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  try {
    const channel = new Channel<unknown>((value) => onProgress(parseExportProgress(value)));
    return parseExportResult(
      await invoke<unknown>(command, { request, outputId, onProgress: channel }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function prepareSourcePreview(sourceId: string): Promise<PreviewDescriptor> {
  try {
    return parsePreviewDescriptor(
      await invoke<unknown>("prepare_source_preview", {
        sourceId,
      }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function prepareAudioPreviews(
  sourceId: string,
  streamIndexes: number[],
): Promise<AudioPreviewDescriptor[]> {
  try {
    return requireArray(
      await invoke<unknown>("prepare_audio_previews", { sourceId, streamIndexes }),
      "audio preview descriptors",
    ).map(parseAudioPreviewDescriptor);
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function prepareProxyPreview(sourceId: string): Promise<PreviewDescriptor> {
  try {
    return parsePreviewDescriptor(
      await invoke<unknown>("prepare_proxy_preview", {
        sourceId,
      }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function prepareWaveforms(
  sourceId: string,
  jobId: string,
  streamIndexes: number[],
  width: number,
): Promise<WaveformResult[]> {
  try {
    return requireArray(
      await invoke<unknown>("prepare_waveforms", {
        sourceId,
        jobId,
        streamIndexes,
        width,
      }),
      "waveform results",
    ).map(parseWaveformResult);
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
}

export async function listenForSourceDrops(
  onEvent: (event: SourceDropEvent) => void,
): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent((event) => {
    switch (event.payload.type) {
      case "enter":
        onEvent({ status: "drag", active: true });
        break;
      case "leave":
        onEvent({ status: "drag", active: false });
        break;
      case "drop": {
        onEvent({ status: "drag", active: false });
        const path = event.payload.paths[0];
        if (!path) {
          onEvent({
            status: "failed",
            error: {
              code: "invalid_request",
              message: "Drop a video file instead of an empty selection.",
            },
          });
          break;
        }
        void importDroppedSource(path).then(
          (source) => onEvent({ status: "selected", source }),
          (error: unknown) => onEvent({ status: "failed", error: normalizeAppError(error) }),
        );
        break;
      }
      case "over":
        break;
    }
  });
}

async function importDroppedSource(path: string): Promise<SourceSelection> {
  try {
    return parseSourceSelection(
      await invoke<unknown>("import_dropped_source", {
        path,
      }),
    );
  } catch (error: unknown) {
    throw normalizeAppError(error);
  }
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

function parseSourceSelection(value: unknown): SourceSelection {
  const source = requireRecord(value, "source selection");
  return {
    sourceId: requireString(source.sourceId, "source ID"),
    displayName: requireString(source.displayName, "display name"),
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
    speed: optionalString(progress.speed),
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

function parsePreviewDescriptor(value: unknown): PreviewDescriptor {
  const preview = requireRecord(value, "preview descriptor");
  const kind = preview.kind;
  if (kind !== "source" && kind !== "proxy") {
    throw invalidResponse("preview kind");
  }
  return {
    sourceId: requireString(preview.sourceId, "source ID"),
    url: requireString(preview.url, "preview URL"),
    kind,
  };
}

function parseAudioPreviewDescriptor(value: unknown): AudioPreviewDescriptor {
  const preview = requireRecord(value, "audio preview descriptor");
  return {
    sourceId: requireString(preview.sourceId, "audio preview source ID"),
    streamIndex: requireInteger(preview.streamIndex, "audio preview stream index"),
    url: requireString(preview.url, "audio preview URL"),
  };
}

function parseWaveformResult(value: unknown): WaveformResult {
  const waveform = requireRecord(value, "waveform result");
  const common = {
    sourceId: requireString(waveform.sourceId, "waveform source ID"),
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

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return typeof value === "boolean" ? value : undefined;
}

function requireInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw invalidResponse(label);
  }
  return value;
}

function requirePositiveInteger(value: unknown, label: string): number {
  const integer = requireInteger(value, label);
  if (integer <= 0) {
    throw invalidResponse(label);
  }
  return integer;
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
