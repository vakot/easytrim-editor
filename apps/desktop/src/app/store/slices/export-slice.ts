import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { sourceCleared, sourceSelected } from "@/app/store/actions/source-actions";
import { cropChanged } from "@/app/store/slices/crop-slice";
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
import type { EditorSnapshot } from "@/domain/editor-snapshot";

export type ExportStatus = "queued" | "rendering" | "completed" | "failed" | "canceled";
export type QueueItemStatus = "imported" | ExportStatus;
export type ImportedOrigin = "source-import" | "history-fork";
export type ExportRoute = "fast" | "optimized";
export type ExportRequest = FastExportRequest | OptimizedExportRequest;

export interface QueueItemBase {
  id: string;
  snapshot: EditorSnapshot;
}

export interface ImportedQueueItem extends QueueItemBase {
  status: "imported";
  origin: ImportedOrigin;
}

export interface ExportSettings {
  resolution: { width: number; height: number };
  frameRate: FrameRate | undefined;
}

export interface ExportQueueItem extends QueueItemBase {
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

export type QueueItem = ImportedQueueItem | ExportQueueItem;

export interface QueueItemPromotion {
  id: string;
  snapshot: EditorSnapshot;
  route: ExportRoute;
  request: ExportRequest;
  outputId: string;
  filename: string;
  path: string;
  totalFrames?: number;
}

export interface ExportState {
  queue: QueueItem[];
  activeItemId: string | null;
  queueStarted: boolean;
  queueFinishAction: QueueFinishAction;
  availableQueueFinishActions: QueueFinishAction[];
  optimizedDialogOpen: boolean;
  optimizedSettings: ExportSettings | null;
  optimizedPlanRequestId: number | null;
  commandPreview: string;
  commandPreviewError: AppError | null;
  launchError: AppError | null;
}

export const initialExportState: ExportState = {
  queue: [],
  activeItemId: null,
  queueStarted: false,
  queueFinishAction: "nothing",
  availableQueueFinishActions: ["exit", "nothing"],
  optimizedDialogOpen: false,
  optimizedSettings: null,
  optimizedPlanRequestId: null,
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
    optimizedExportPlanRequested: (state, action: PayloadAction<{ requestId: number }>) => {
      state.optimizedPlanRequestId = action.payload.requestId;
      state.commandPreviewError = null;
    },
    optimizedExportPlanReceived: (
      state,
      action: PayloadAction<{ requestId: number; commandPreview: string }>,
    ) => {
      if (action.payload.requestId !== state.optimizedPlanRequestId) return;
      state.commandPreview = action.payload.commandPreview;
      state.commandPreviewError = null;
    },
    optimizedExportPlanFailed: (
      state,
      action: PayloadAction<{ requestId: number; error: AppError }>,
    ) => {
      if (action.payload.requestId !== state.optimizedPlanRequestId) return;
      state.commandPreviewError = action.payload.error;
    },
    exportLaunchFailed: (state, action: PayloadAction<AppError>) => {
      state.launchError = action.payload;
    },
    queueEntryAdded: (state, action: PayloadAction<QueueItem>) => {
      state.queue.push(action.payload);
      if (action.payload.status === "imported") state.activeItemId = action.payload.id;
    },
    importedQueueItemAdded: (state, action: PayloadAction<ImportedQueueItem>) => {
      state.queue.push(action.payload);
      state.activeItemId = action.payload.id;
    },
    importedQueueItemsAdded: (state, action: PayloadAction<ImportedQueueItem[]>) => {
      state.queue.push(...action.payload);
    },
    importedQueueItemRemoved: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter((item) => item.id !== action.payload);
      if (state.activeItemId === action.payload) state.activeItemId = null;
    },
    activeQueueItemChanged: (state, action: PayloadAction<string | null>) => {
      state.activeItemId = action.payload;
    },
    queueItemSnapshotUpdated: (
      state,
      action: PayloadAction<{ id: string; snapshot: EditorSnapshot }>,
    ) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (item?.status === "imported") item.snapshot = action.payload.snapshot;
    },
    queueItemPromoted: (state, action: PayloadAction<QueueItemPromotion>) => {
      const index = state.queue.findIndex((candidate) => candidate.id === action.payload.id);
      const item = state.queue[index];
      if (!item || item.status !== "imported") return;
      state.queue[index] = {
        ...action.payload,
        status: "queued",
        operationId: null,
        startedAt: null,
        durationMs: null,
        progressPercent: 0,
      };
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
        durationMs: number | null;
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
      const { progress, durationMs, ...metrics } = action.payload;
      Object.assign(item, {
        operationId: progress.operationId,
        durationMs,
        currentFrame: progress.frame,
        fileSizeBytes: progress.totalSize,
        ...metrics,
      });
    },
    exportCompleted: (
      state,
      action: PayloadAction<{ id: string; result: ExportResult; durationMs: number | null }>,
    ) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status === "imported" || item.status === "canceled") return;
      item.operationId = action.payload.result.operationId;
      item.path = action.payload.result.displayPath;
      item.status = "completed";
      item.progressPercent = 100;
      item.durationMs = action.payload.durationMs;
    },
    exportFailed: (
      state,
      action: PayloadAction<{ id: string; error: AppError; durationMs: number | null }>,
    ) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status === "imported" || item.status === "canceled") return;
      item.status = "failed";
      item.error = action.payload.error.message;
      item.durationMs = action.payload.durationMs;
    },
    exportCanceled: (state, action: PayloadAction<{ id: string; durationMs: number | null }>) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (
        !item ||
        item.status === "imported" ||
        item.status === "completed" ||
        item.status === "failed"
      )
        return;
      item.status = "canceled";
      item.error = undefined;
      item.durationMs = action.payload.durationMs;
    },
    finishedExportsCleared: (state) => {
      state.queue = state.queue.filter(
        (item) =>
          item.status === "imported" || !["completed", "failed", "canceled"].includes(item.status),
      );
    },
  },
  extraReducers: (builder) => {
    builder.addCase(sourceSelected, (state) => {
      state.optimizedDialogOpen = false;
      state.optimizedSettings = null;
      state.optimizedPlanRequestId = null;
      state.commandPreview = "";
      state.commandPreviewError = null;
      state.launchError = null;
    });
    builder.addCase(sourceCleared, (state) => {
      state.activeItemId = null;
      state.optimizedDialogOpen = false;
      state.optimizedSettings = null;
      state.optimizedPlanRequestId = null;
      state.commandPreview = "";
      state.commandPreviewError = null;
      state.launchError = null;
    });
    builder.addCase(cropChanged, (state, action) => {
      if (state.optimizedSettings) {
        state.optimizedSettings.resolution = action.payload.resolution;
      }
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
  importedQueueItemAdded,
  importedQueueItemsAdded,
  importedQueueItemRemoved,
  activeQueueItemChanged,
  queueItemSnapshotUpdated,
  queueItemPromoted,
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

export const selectQueueItems = (state: RootState): QueueItem[] => state.export.queue;
export const selectActiveItemId = (state: RootState): string | null => state.export.activeItemId;
export const selectActiveQueueItem = createSelector(
  [selectQueueItems, selectActiveItemId],
  (queue, activeItemId) => queue.find((item) => item.id === activeItemId),
);
export const selectImportedQueueItems = createSelector(
  [selectQueueItems],
  (queue): ImportedQueueItem[] =>
    queue.filter((item): item is ImportedQueueItem => item.status === "imported"),
);
export const selectExportQueue = createSelector([selectQueueItems], (queue): ExportQueueItem[] =>
  queue.filter((item): item is ExportQueueItem => item.status !== "imported"),
);
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
export const selectHasProcessableExports = (state: RootState): boolean =>
  state.export.queue.some((item) => item.status === "queued" || item.status === "rendering");
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
export const selectExportLaunchError = (state: RootState): AppError | null =>
  state.export.launchError;
