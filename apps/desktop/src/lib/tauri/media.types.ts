import type { SourceRef } from "@/domain/source";

export interface AppError {
  code: string;
  message: string;
  diagnostics?: string;
}

interface TrimSelection {
  startMicros: number;
  endMicros: number;
}

export interface ExportProgress {
  operationId: string;
  elapsedMicros: number;
  frame?: number;
  fps?: string;
  speed?: string;
  bitrate?: string;
  totalSize?: number;
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
  sourcePath: string;
  trim: TrimSelection;
  audioTracks: AudioTrackSelection[];
  mergeAudio: boolean;
}

interface AudioTrackSelection {
  streamIndex: number;
  volumePercent: number;
}

export interface OptimizedExportRequest extends FastExportRequest {
  resolution: { width: number; height: number };
  crop?: { x: number; y: number; width: number; height: number };
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
  mediaToken: number;
  url: string;
  kind: PreviewKind;
}

export interface AudioPreviewDescriptor {
  mediaToken: number;
  streamIndex: number;
  url: string;
}

export type WaveformResult =
  | {
      status: "ready";
      jobId: string;
      streamIndex: number;
      width: number;
      hasSignal?: boolean;
      url: string;
    }
  | {
      status: "failed";
      jobId: string;
      streamIndex: number;
      width: number;
      error: AppError;
    };

type SourceImportEvent =
  { status: "selected"; sources: SourceRef[] } | { status: "failed"; error: AppError };

export type SourceDropEvent = { status: "drag"; active: boolean } | SourceImportEvent;
