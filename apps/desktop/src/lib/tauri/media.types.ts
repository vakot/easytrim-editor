import type { AudioTrackProcessing } from "@/domain/audio-processing";
import type {
  AppError,
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

interface AudioPreviewDescriptor {
  mediaToken: number;
  previewRevision: number;
  processing: AudioTrackProcessing;
  streamIndex: number;
  url: string;
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
  AudioPreviewDescriptor,
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
  PreviewDescriptor,
  SilenceRange,
  SourceImportResult,
  ThumbnailDescriptor,
  VideoStream,
};
