import type {
  AppError,
  AudioExportRequest,
  AudioStream,
  ChapterInfo,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  GifExportRequest,
  LoudnessAnalysis,
  LoudnessAnalysisRequest,
  MediaInfo,
  OptimizedExportRequest,
  OutputSelection,
  VideoStream,
} from "@/domain/media";
import type { SourceRef } from "@/domain/source";

interface ExportPlan {
  commandPreview: string;
}

interface BinaryCapability {
  available: boolean;
  diagnostics?: string;
  errorId?: BinaryCapabilityErrorId;
  path?: string;
  version?: string;
}

type BinaryCapabilityErrorId = "notFound" | "timedOut" | "startFailed" | "checkFailed";

interface MediaCapabilities {
  ffmpeg: BinaryCapability;
  ffprobe: BinaryCapability;
}

export type PreviewKind = "source" | "proxy";

interface PreviewDescriptor {
  kind: PreviewKind;
  mediaToken: number;
  url: string;
}

interface ThumbnailDescriptor {
  mediaToken: number;
  url: string;
}

/** Interleaved processed stereo float PCM at 48 kHz. */
interface PlaybackPcmChunk {
  channels: 2;
  sampleRate: 48_000;
  samples: Float32Array;
}

interface SilenceRange {
  endMicros: number;
  startMicros: number;
}

export type WaveformResult =
  | {
      hasSignal?: boolean;
      jobId: string;
      status: "ready";
      streamIndex: number;
      url: string;
      width: number;
    }
  | {
      error: AppError;
      jobId: string;
      status: "failed";
      streamIndex: number;
      width: number;
    };

interface SourceImportResult {
  acceptedFileCount: number;
  directFileCount: number;
  discoveredFileCount: number;
  folderCount: number;
  readErrorCount: number;
  recursive: boolean;
  skippedFileCount: number;
  sources: SourceRef[];
  truncated: boolean;
  truncationReason?: string;
}

export type SourcePickerMode = "files" | "folders";

type SourceImportEvent =
  | { importResult: SourceImportResult; operationId?: string; status: "selected" }
  | { operationId?: string; sources: SourceRef[]; status: "selected" }
  | { error: AppError; operationId?: string; status: "failed" };

export type SourceDropEvent = { active: boolean; status: "drag" } | SourceImportEvent;

export type {
  AppError,
  AudioExportRequest,
  AudioStream,
  BinaryCapability,
  BinaryCapabilityErrorId,
  ChapterInfo,
  ExportPlan,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  GifExportRequest,
  LoudnessAnalysis,
  LoudnessAnalysisRequest,
  MediaCapabilities,
  MediaInfo,
  OptimizedExportRequest,
  OutputSelection,
  PlaybackPcmChunk,
  PreviewDescriptor,
  SilenceRange,
  SourceImportResult,
  ThumbnailDescriptor,
  VideoStream,
};
