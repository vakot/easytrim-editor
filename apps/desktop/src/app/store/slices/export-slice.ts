import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { sourceCleared, sourceSelected } from "@/app/store/actions/source-actions";
import type {
  AppError,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  OptimizedExportRequest,
} from "@/lib/tauri/media";
import type { QueueFinishAction } from "@/lib/tauri/queue";
import type { RootState } from "../store";

export type ExportStatus = "queued" | "rendering" | "completed" | "failed" | "canceled";
export type ExportRoute = "fast" | "optimized";
export type ExportRequest = FastExportRequest | OptimizedExportRequest;

export interface ExportSettings {
  resolution: { width: number; height: number };
  frameRate: FrameRate | undefined;
}

export interface ExportQueueItem {
  id: string;
  route: ExportRoute;
  request: ExportRequest;
  outputId: string;
  filename: string;
  path: string;
  status: ExportStatus;
  operationId: string | null;
  startedAt: number | null;
  durationMs: number | null;
  progressPercent: number;
  currentFrame?: number;
  totalFrames?: number;
  fps?: number;
  bitrate?: string;
  fileSizeBytes?: number;
  estimatedFileSizeBytes?: number;
  estimatedElapsedTimeMs?: number;
  estimatedTotalTimeMs?: number;
  error?: string;
}

export interface ExportState {
  queue: ExportQueueItem[];
  queueStarted: boolean;
  queueFinishAction: QueueFinishAction;
  availableQueueFinishActions: QueueFinishAction[];
  optimizedDialogOpen: boolean;
  optimizedSettings: ExportSettings | null;
  commandPreview: string;
  commandPreviewError: AppError | null;
  launchError: AppError | null;
}

export const initialExportState: ExportState = {
  queue: [],
  queueStarted: false,
  queueFinishAction: "nothing",
  availableQueueFinishActions: ["exit", "nothing"],
  optimizedDialogOpen: false,
  optimizedSettings: null,
  commandPreview: "",
  commandPreviewError: null,
  launchError: null,
};

const exportSlice = createSlice({
  name: "export",
  initialState: initialExportState,
  reducers: {
    optimizedExportDialogOpened: (state, action: PayloadAction<ExportSettings>) => {
      state.optimizedDialogOpen = true;
      state.optimizedSettings ??= action.payload;
      state.launchError = null;
    },
    optimizedExportDialogClosed: (state) => {
      state.optimizedDialogOpen = false;
    },
    optimizedExportSettingsChanged: (state, action: PayloadAction<ExportSettings>) => {
      state.optimizedSettings = action.payload;
    },
    optimizedExportPlanRequested: (state) => {
      state.commandPreviewError = null;
    },
    optimizedExportPlanReceived: (state, action: PayloadAction<string>) => {
      state.commandPreview = action.payload;
      state.commandPreviewError = null;
    },
    optimizedExportPlanFailed: (state, action: PayloadAction<AppError>) => {
      state.commandPreviewError = action.payload;
    },
    exportLaunchFailed: (state, action: PayloadAction<AppError>) => {
      state.launchError = action.payload;
    },
    queueEntryAdded: (state, action: PayloadAction<ExportQueueItem>) => {
      state.queue.push(action.payload);
    },
    queueStarted: (state) => {
      state.queueStarted = true;
    },
    queuePaused: (state) => {
      state.queueStarted = false;
    },
    queueFinishActionChanged: (state, action: PayloadAction<QueueFinishAction>) => {
      state.queueFinishAction = action.payload;
    },
    queueFinishActionsAvailable: (state, action: PayloadAction<QueueFinishAction[]>) => {
      state.availableQueueFinishActions = action.payload;
      if (!action.payload.includes(state.queueFinishAction)) {
        state.queueFinishAction = action.payload.includes("nothing")
          ? "nothing"
          : (action.payload[0] ?? "nothing");
      }
    },
    exportStarted: (state, action: PayloadAction<{ id: string; startedAt: number }>) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status !== "queued") return;
      item.status = "rendering";
      item.startedAt = action.payload.startedAt;
    },
    exportProgressReceived: (
      state,
      action: PayloadAction<{
        id: string;
        progress: ExportProgress;
        progressPercent: number;
        estimatedFileSizeBytes?: number;
        estimatedElapsedTimeMs?: number;
        estimatedTotalTimeMs?: number;
        fps?: number;
        bitrate?: string;
      }>,
    ) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status !== "rendering") return;
      const { progress, ...metrics } = action.payload;
      Object.assign(item, {
        operationId: progress.operationId,
        durationMs: item.startedAt ? Date.now() - item.startedAt : null,
        currentFrame: progress.frame,
        fileSizeBytes: progress.totalSize,
        ...metrics,
      });
    },
    exportCompleted: (state, action: PayloadAction<{ id: string; result: ExportResult }>) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status === "canceled") return;
      item.operationId = action.payload.result.operationId;
      item.path = action.payload.result.displayPath;
      item.status = "completed";
      item.progressPercent = 100;
      item.durationMs = item.startedAt ? Date.now() - item.startedAt : null;
    },
    exportFailed: (state, action: PayloadAction<{ id: string; error: AppError }>) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status === "canceled") return;
      item.status = "failed";
      item.error = action.payload.error.message;
      item.durationMs = item.startedAt ? Date.now() - item.startedAt : null;
    },
    exportCanceled: (state, action: PayloadAction<{ id: string }>) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status === "completed" || item.status === "failed") return;
      item.status = "canceled";
      item.error = undefined;
      item.durationMs = item.startedAt ? Date.now() - item.startedAt : null;
    },
    finishedExportsCleared: (state) => {
      state.queue = state.queue.filter(
        (item) => item.status !== "completed" && item.status !== "failed" && item.status !== "canceled",
      );
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sourceSelected, (state) => {
      state.optimizedDialogOpen = false;
      state.optimizedSettings = null;
      state.commandPreview = "";
      state.commandPreviewError = null;
      state.launchError = null;
    });
    builder.addCase(sourceCleared, (state) => {
      state.optimizedDialogOpen = false;
      state.optimizedSettings = null;
      state.commandPreview = "";
      state.commandPreviewError = null;
      state.launchError = null;
    });
  },
});

export const {
  optimizedExportDialogOpened,
  optimizedExportDialogClosed,
  optimizedExportSettingsChanged,
  optimizedExportPlanRequested,
  optimizedExportPlanReceived,
  optimizedExportPlanFailed,
  exportLaunchFailed,
  queueEntryAdded,
  queueStarted,
  queuePaused,
  queueFinishActionChanged,
  queueFinishActionsAvailable,
  exportStarted,
  exportProgressReceived,
  exportCompleted,
  exportFailed,
  exportCanceled,
  finishedExportsCleared,
} = exportSlice.actions;
export const exportReducer = exportSlice.reducer;

export const selectExportState = (state: RootState): ExportState => state.export;
export const selectExportQueue = (state: RootState): ExportQueueItem[] => state.export.queue;
export const selectExportQueueItems = selectExportQueue;
export const selectActiveExport = createSelector([selectExportQueue], (queue) =>
  queue.find((item) => item.status === "rendering"),
);
export const selectExportProgress = (state: RootState): number =>
  selectActiveExport(state)?.progressPercent ?? 0;
export const selectExportRunning = (state: RootState): boolean =>
  selectActiveExport(state) !== undefined;
export const selectHasQueuedExports = (state: RootState): boolean =>
  state.export.queue.some((item) => item.status === "queued");
export const selectHasActiveExport = (state: RootState): boolean =>
  state.export.queue.some((item) => item.status === "rendering");
export const selectCanStartQueue = (state: RootState): boolean =>
  !state.export.queueStarted && selectHasQueuedExports(state);
export const selectQueueStarted = (state: RootState): boolean => state.export.queueStarted;
export const selectQueueFinishAction = (state: RootState): QueueFinishAction =>
  state.export.queueFinishAction;
export const selectAvailableQueueFinishActions = (state: RootState): QueueFinishAction[] =>
  state.export.availableQueueFinishActions;
export const selectOptimizedExportDialogOpen = (state: RootState): boolean =>
  state.export.optimizedDialogOpen;
export const selectExportSettings = (state: RootState): ExportSettings | null =>
  state.export.optimizedSettings;
export const selectExportCommandPreview = (state: RootState): string => state.export.commandPreview;
export const selectExportCommandPreviewError = (state: RootState): AppError | null =>
  state.export.commandPreviewError;
export const selectExportLaunchError = (state: RootState): AppError | null => state.export.launchError;
