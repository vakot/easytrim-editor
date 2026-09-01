import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { importQueueItemActivated } from "@/app/store/actions/imported-queue-actions";
import { sourceCleared, sourceSelected } from "@/app/store/actions/source-actions";
import { cropChanged } from "@/app/store/slices/crop-slice";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import type {
  AppError,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  MediaInfo,
  OptimizedExportRequest,
} from "@/lib/tauri/media.types";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

import type { RootState } from "../store";

type ExportStatus = "queued" | "rendering" | "completed" | "failed" | "canceled";
type ImportedOrigin = "source-import" | "history-fork";
type ExportRoute = "fast" | "optimized";
type ExportRequest = FastExportRequest | OptimizedExportRequest;

interface QueueItemBase {
  id: string;
  media?: MediaInfo;
  snapshot: EditorSnapshot;
}

export interface ImportQueueItem extends QueueItemBase {
  origin: ImportedOrigin;
  status: "imported";
}

export interface ExportSettings {
  frameRate: FrameRate | undefined;
  resolution: { height: number; width: number };
}

export interface ExportQueueItem extends QueueItemBase {
  addedAt: number;
  bitrate?: string;
  currentFrame?: number;
  durationMs: number | null;
  error?: string;
  estimatedElapsedTimeMs?: number;
  estimatedFileSizeBytes?: number;
  estimatedTotalTimeMs?: number;
  filename: string;
  fileSizeBytes?: number;
  fps?: number;
  operationId: string | null;
  outputId: string;
  path: string;
  progressPercent: number;
  request: ExportRequest;
  route: ExportRoute;
  sourceDeleted?: boolean;
  startedAt: number | null;
  status: ExportStatus;
  totalFrames?: number;
}

type QueueItem = ImportQueueItem | ExportQueueItem;

export interface QueueItemPromotion {
  addedAt: number;
  filename: string;
  id: string;
  media?: MediaInfo;
  outputId: string;
  path: string;
  request: ExportRequest;
  route: ExportRoute;
  snapshot: EditorSnapshot;
  totalFrames?: number;
}

interface ExportState {
  activeItemId: string | null;
  availableQueueFinishActions: QueueFinishAction[];
  commandPreview: string;
  commandPreviewError: AppError | null;
  launchError: AppError | null;
  optimizedDialogOpen: boolean;
  optimizedPlanRequestId: number | null;
  optimizedSettings: ExportSettings | null;
  queue: QueueItem[];
  queueFinishAction: QueueFinishAction;
  queueStarted: boolean;
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
      action: PayloadAction<{ commandPreview: string; requestId: number }>,
    ) => {
      if (action.payload.requestId !== state.optimizedPlanRequestId) return;
      state.commandPreview = action.payload.commandPreview;
      state.commandPreviewError = null;
    },
    optimizedExportPlanFailed: (
      state,
      action: PayloadAction<{ error: AppError; requestId: number }>,
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
    importQueueItemAdded: (state, action: PayloadAction<ImportQueueItem>) => {
      state.queue.push(action.payload);
      state.activeItemId = action.payload.id;
    },
    importQueueItemsAdded: (state, action: PayloadAction<ImportQueueItem[]>) => {
      state.queue.push(...action.payload);
    },
    importQueueItemRemoved: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter((item) => item.id !== action.payload);
      if (state.activeItemId === action.payload) state.activeItemId = null;
    },
    activeQueueItemChanged: (state, action: PayloadAction<string | null>) => {
      state.activeItemId = action.payload;
    },
    queueItemSnapshotUpdated: (
      state,
      action: PayloadAction<{ id: string; media?: MediaInfo; snapshot: EditorSnapshot }>,
    ) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (item?.status === "imported") {
        item.snapshot = action.payload.snapshot;
        item.media = action.payload.media;
      }
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
        bitrate?: string;
        durationMs: number | null;
        estimatedElapsedTimeMs?: number;
        estimatedFileSizeBytes?: number;
        estimatedTotalTimeMs?: number;
        fps?: number;
        id: string;
        progress: ExportProgress;
        progressPercent: number;
      }>,
    ) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status !== "rendering") return;
      const { durationMs, progress, ...metrics } = action.payload;
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
      action: PayloadAction<{ durationMs: number | null; id: string; result: ExportResult }>,
    ) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status === "imported" || item.status === "canceled") return;
      item.operationId = action.payload.result.operationId;
      item.path = action.payload.result.displayPath;
      item.status = "completed";
      item.progressPercent = 100;
      item.durationMs = action.payload.durationMs;
    },
    exportSourceDeleted: (state, action: PayloadAction<{ id: string }>) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status !== "completed") return;
      item.sourceDeleted = true;
    },
    exportSourceRestored: (state, action: PayloadAction<{ id: string }>) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status !== "completed" || !item.sourceDeleted) return;
      item.sourceDeleted = false;
    },
    exportFailed: (
      state,
      action: PayloadAction<{ durationMs: number | null; error: AppError; id: string }>,
    ) => {
      const item = state.queue.find((candidate) => candidate.id === action.payload.id);
      if (!item || item.status === "imported" || item.status === "canceled") return;
      item.status = "failed";
      item.error = action.payload.error.message;
      item.durationMs = action.payload.durationMs;
    },
    exportCanceled: (state, action: PayloadAction<{ durationMs: number | null; id: string }>) => {
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
    const resetSourceExportState = (state: ExportState) => {
      state.optimizedDialogOpen = false;
      state.optimizedSettings = null;
      state.optimizedPlanRequestId = null;
      state.commandPreview = "";
      state.commandPreviewError = null;
      state.launchError = null;
    };

    builder.addCase(sourceSelected, resetSourceExportState);
    builder.addCase(importQueueItemActivated, (state, action) => {
      state.activeItemId = action.payload.id;
      resetSourceExportState(state);
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
  activeQueueItemChanged,
  exportCanceled,
  exportCompleted,
  exportFailed,
  exportLaunchFailed,
  exportProgressReceived,
  exportSourceDeleted,
  exportSourceRestored,
  exportStarted,
  finishedExportsCleared,
  importQueueItemAdded,
  importQueueItemRemoved,
  importQueueItemsAdded,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  optimizedExportSettingsChanged,
  queueEntryAdded,
  queueFinishActionChanged,
  queueFinishActionsAvailable,
  queueItemPromoted,
  queueItemSnapshotUpdated,
  queuePaused,
  queueStarted,
} = exportSlice.actions;
export const exportReducer = exportSlice.reducer;

const selectQueueItems = (state: RootState): QueueItem[] => state.export.queue;
export const selectActiveItemId = (state: RootState): string | null => state.export.activeItemId;
export const selectActiveQueueItem = createSelector(
  [selectQueueItems, selectActiveItemId],
  (queue, activeItemId) => queue.find((item) => item.id === activeItemId),
);
export const selectImportQueueItems = createSelector(
  [selectQueueItems],
  (queue): ImportQueueItem[] =>
    queue.filter((item): item is ImportQueueItem => item.status === "imported"),
);
export const selectExportQueue = createSelector([selectQueueItems], (queue): ExportQueueItem[] => {
  const exportQueue = queue.filter((item): item is ExportQueueItem => item.status !== "imported");

  return exportQueue.sort((left, right) => {
    const addedAtOrder = right.addedAt - left.addedAt;
    if (addedAtOrder !== 0 && !Number.isNaN(addedAtOrder)) return addedAtOrder;
    return String(right.id ?? "").localeCompare(String(left.id ?? ""));
  });
});
export const selectHasProcessableExports = (state: RootState): boolean =>
  state.export.queue.some((item) => item.status === "queued" || item.status === "rendering");
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
