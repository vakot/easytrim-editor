import type {
  AppError,
  AudioStream,
  ChapterInfo,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  MediaInfo,
  OptimizedExportRequest,
  OutputSelection,
  VideoStream,
} from "@/domain/media";
import type { SourceRef } from "@/domain/source";

interface OptimizedExportPlan {
  commandPreview: string;
}

interface BinaryCapability {
  available: boolean;
  error?: string;
  path?: string;
  version?: string;
}

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
  streamIndex: number;
  url: string;
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
  ChapterInfo,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  MediaCapabilities,
  MediaInfo,
  OptimizedExportPlan,
  OptimizedExportRequest,
  OutputSelection,
  PreviewDescriptor,
  SourceImportResult,
  ThumbnailDescriptor,
  VideoStream,
};
