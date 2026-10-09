import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { queueSettingsReset } from "@/app/store/actions/queue-actions";
import { sourceCleared } from "@/app/store/actions/source-actions";
import type { AppError } from "@/lib/tauri/media.types";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

import type { RootState } from "../store";

interface ExportUiState {
  availableQueueFinishActions: QueueFinishAction[];
  commandPreview: string;
  commandPreviewError: AppError | null;
  dialogRoute: "optimized" | "gif";
  exportPlanRequestId: number | null;
  exportQueueDialogOpen: boolean;
  launchError: AppError | null;
  optimizedDialogOpen: boolean;
  queueEdit: { attemptId: string; instanceId: string; route: "fast" | "optimized" | "gif" } | null;
  queueFinishAction: QueueFinishAction;
  startedSourceIds: string[];
}

export const initialExportState: ExportUiState = {
  availableQueueFinishActions: ["exit", "nothing"],
  commandPreview: "",
  commandPreviewError: null,
  dialogRoute: "optimized",
  launchError: null,
  exportQueueDialogOpen: false,
  optimizedDialogOpen: false,
  exportPlanRequestId: null,
  queueFinishAction: "nothing",
  queueEdit: null,
  startedSourceIds: [],
};

const exportSlice = createSlice({
  name: "export",
  initialState: initialExportState,
  reducers: {
    exportQueueDialogOpened: (state) => {
      state.exportQueueDialogOpen = true;
    },
    exportQueueDialogClosed: (state) => {
      state.exportQueueDialogOpen = false;
    },
    optimizedExportDialogOpened: (state) => {
      state.optimizedDialogOpen = true;
      state.dialogRoute = "optimized";
      state.launchError = null;
    },
    gifExportDialogOpened: (state) => {
      state.optimizedDialogOpen = true;
      state.dialogRoute = "gif";
      state.launchError = null;
    },
    optimizedExportDialogClosed: (state) => {
      state.optimizedDialogOpen = false;
      state.dialogRoute = "optimized";
    },
    exportPlanRequested: (state, action: PayloadAction<{ requestId: number }>) => {
      state.exportPlanRequestId = action.payload.requestId;
      state.commandPreview = "";
      state.commandPreviewError = null;
    },
    exportPlanReceived: (
      state,
      action: PayloadAction<{ commandPreview: string; requestId: number }>,
    ) => {
      if (action.payload.requestId !== state.exportPlanRequestId) return;
      state.commandPreview = action.payload.commandPreview;
      state.commandPreviewError = null;
    },
    exportPlanFailed: (state, action: PayloadAction<{ error: AppError; requestId: number }>) => {
      if (action.payload.requestId !== state.exportPlanRequestId) return;
      state.commandPreviewError = action.payload.error;
    },
    exportLaunchFailed: (state, action: PayloadAction<AppError>) => {
      state.launchError = action.payload;
    },
    queueStarted: (state, action: PayloadAction<string[]>) => {
      state.startedSourceIds = [...new Set([...state.startedSourceIds, ...action.payload])];
    },
    queuePaused: (state, action: PayloadAction<string | undefined>) => {
      state.startedSourceIds =
        action.payload === undefined
          ? []
          : state.startedSourceIds.filter((id) => id !== action.payload);
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
    queueEditStarted: (
      state,
      action: PayloadAction<{
        attemptId: string;
        instanceId: string;
        route: "fast" | "optimized" | "gif";
      }>,
    ) => {
      state.queueEdit = action.payload;
    },
    queueEditFinished: (state) => {
      state.queueEdit = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(queueSettingsReset, (state) => {
      state.queueFinishAction = state.availableQueueFinishActions.includes("nothing")
        ? "nothing"
        : (state.availableQueueFinishActions[0] ?? "nothing");
    });
    builder.addCase(sourceCleared, (state) => {
      state.optimizedDialogOpen = false;
      state.dialogRoute = "optimized";
      state.exportPlanRequestId = null;
      state.commandPreview = "";
      state.commandPreviewError = null;
      state.launchError = null;
    });
  },
});

const {
  exportLaunchFailed,
  exportPlanFailed,
  exportPlanReceived,
  exportPlanRequested,
  exportQueueDialogClosed,
  exportQueueDialogOpened,
  gifExportDialogOpened,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  queueEditFinished,
  queueEditStarted,
  queueFinishActionChanged,
  queueFinishActionsAvailable,
  queuePaused,
  queueStarted,
} = exportSlice.actions;

const exportReducer = exportSlice.reducer;

const selectSourceQueueStarted = (state: RootState, instanceId: string): boolean =>
  state.export.startedSourceIds.includes(instanceId);

const selectQueueFinishAction = (state: RootState): QueueFinishAction =>
  state.export.queueFinishAction;

const selectAvailableQueueFinishActions = (state: RootState): QueueFinishAction[] =>
  state.export.availableQueueFinishActions;

const selectExportDialogOpen = (state: RootState): boolean => state.export.optimizedDialogOpen;

const selectExportDialogRoute = (state: RootState): ExportUiState["dialogRoute"] =>
  state.export.dialogRoute;

const selectExportQueueDialogOpen = (state: RootState): boolean =>
  state.export.exportQueueDialogOpen;

const selectExportCommandPreview = (state: RootState): string => state.export.commandPreview;
const selectExportCommandPreviewError = (state: RootState): AppError | null =>
  state.export.commandPreviewError;

const selectExportLaunchError = (state: RootState): AppError | null => state.export.launchError;
const selectQueueEdit = (state: RootState): ExportUiState["queueEdit"] => state.export.queueEdit;

export {
  exportLaunchFailed,
  exportPlanFailed,
  exportPlanReceived,
  exportPlanRequested,
  exportQueueDialogClosed,
  exportQueueDialogOpened,
  exportReducer,
  gifExportDialogOpened,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  queueEditFinished,
  queueEditStarted,
  queueFinishActionChanged,
  queueFinishActionsAvailable,
  queuePaused,
  queueStarted,
  selectAvailableQueueFinishActions,
  selectExportCommandPreview,
  selectExportCommandPreviewError,
  selectExportDialogOpen,
  selectExportDialogRoute,
  selectExportLaunchError,
  selectExportQueueDialogOpen,
  selectQueueEdit,
  selectQueueFinishAction,
  selectSourceQueueStarted,
};
