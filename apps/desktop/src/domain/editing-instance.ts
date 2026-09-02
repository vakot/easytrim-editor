import type {
  AppError,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  MediaInfo,
  OptimizedExportRequest,
  OutputSelection,
} from "@/domain/media";

export type EditingInstanceId = string;
export type InstanceOrigin = "source-import" | "duplicate";
export type ExportRoute = "fast" | "optimized";
export type ExportRequest = FastExportRequest | OptimizedExportRequest;

export interface ExportSettings {
  frameRate: FrameRate | undefined;
  resolution: { height: number; width: number };
}

export type SourceAvailability = "available" | "deleted" | "missing";

export type ExportAttemptState =
  | { queuedAt: number; status: "queued" }
  | { operationId: string | null; startedAt: number; status: "rendering" }
  | { completedAt: number; result: ExportResult; status: "completed" }
  | { error: AppError; failedAt: number; status: "failed" }
  | { canceledAt: number; error?: AppError; status: "canceled" };

export interface ExportAttemptMetrics {
  bitrate?: string;
  currentFrame?: number;
  durationMs: number | null;
  estimatedElapsedTimeMs?: number;
  estimatedFileSizeBytes?: number;
  estimatedTotalTimeMs?: number;
  fileSizeBytes?: number;
  fps?: number;
  progressPercent: number;
  totalFrames?: number;
}

export interface ExportAttempt {
  capturedAt: number;
  id: string;
  metrics: ExportAttemptMetrics;
  output: OutputSelection;
  request: ExportRequest;
  route: ExportRoute;
  snapshot: import("@/domain/editor-snapshot").EditorSnapshot;
  state: ExportAttemptState;
}

export interface EditingInstance {
  exportAttempts: ExportAttempt[];
  id: EditingInstanceId;
  media?: MediaInfo;
  optimizedSettings?: ExportSettings;
  origin: InstanceOrigin;
  snapshot: import("@/domain/editor-snapshot").EditorSnapshot;
  sourceAvailability: SourceAvailability;
}

export interface EditingInstancesState {
  activeInstanceId: EditingInstanceId | null;
  entities: Record<EditingInstanceId, EditingInstance>;
  ids: EditingInstanceId[];
}

export const EMPTY_EXPORT_METRICS: ExportAttemptMetrics = {
  durationMs: null,
  progressPercent: 0,
};

export function createExportAttempt(input: {
  capturedAt: number;
  id: string;
  output: OutputSelection;
  request: ExportRequest;
  route: ExportRoute;
  snapshot: import("@/domain/editor-snapshot").EditorSnapshot;
  totalFrames?: number;
}): ExportAttempt {
  return {
    capturedAt: input.capturedAt,
    id: input.id,
    metrics: {
      ...EMPTY_EXPORT_METRICS,
      ...(input.totalFrames === undefined ? {} : { totalFrames: input.totalFrames }),
    },
    output: { ...input.output },
    request: structuredClone(input.request),
    route: input.route,
    snapshot: structuredClone(input.snapshot),
    state: { queuedAt: input.capturedAt, status: "queued" },
  };
}

export function isActiveExportAttempt(attempt: ExportAttempt): boolean {
  return attempt.state.status === "queued" || attempt.state.status === "rendering";
}

export function isTerminalExportAttempt(attempt: ExportAttempt): boolean {
  return !isActiveExportAttempt(attempt);
}

export function updateAttemptProgress(attempt: ExportAttempt, progress: ExportProgress) {
  if (attempt.state.status !== "rendering") return;
  attempt.state.operationId = progress.operationId;
}
