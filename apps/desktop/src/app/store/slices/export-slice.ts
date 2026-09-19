import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { sourceCleared } from "@/app/store/actions/source-actions";
import type { AppError } from "@/lib/tauri/media.types";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

import type { RootState } from "../store";

interface ExportUiState {
  availableQueueFinishActions: QueueFinishAction[];
  commandPreview: string;
  commandPreviewError: AppError | null;
  launchError: AppError | null;
  optimizedDialogOpen: boolean;
  optimizedPlanRequestId: number | null;
  queueFinishAction: QueueFinishAction;
  startedSourceIds: string[];
}

export const initialExportState: ExportUiState = {
  availableQueueFinishActions: ["exit", "nothing"],
  commandPreview: "",
  commandPreviewError: null,
  launchError: null,
  optimizedDialogOpen: false,
  optimizedPlanRequestId: null,
  queueFinishAction: "nothing",
  startedSourceIds: [],
};

const exportSlice = createSlice({
  name: "export",
  initialState: initialExportState,
  reducers: {
    optimizedExportDialogOpened: (state) => {
      state.optimizedDialogOpen = true;
      state.launchError = null;
    },
    optimizedExportDialogClosed: (state) => {
      state.optimizedDialogOpen = false;
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
  },
  extraReducers: (builder) => {
    builder.addCase(sourceCleared, (state) => {
      state.optimizedDialogOpen = false;
      state.optimizedPlanRequestId = null;
      state.commandPreview = "";
      state.commandPreviewError = null;
      state.launchError = null;
    });
  },
});

export const {
  exportLaunchFailed,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  queueFinishActionChanged,
  queueFinishActionsAvailable,
  queuePaused,
  queueStarted,
} = exportSlice.actions;
export const exportReducer = exportSlice.reducer;

export const selectQueueStarted = (state: RootState): boolean =>
  state.export.startedSourceIds.length > 0;
export const selectSourceQueueStarted = (state: RootState, instanceId: string): boolean =>
  state.export.startedSourceIds.includes(instanceId);
export const selectQueueFinishAction = (state: RootState): QueueFinishAction =>
  state.export.queueFinishAction;
export const selectAvailableQueueFinishActions = (state: RootState): QueueFinishAction[] =>
  state.export.availableQueueFinishActions;
export const selectOptimizedExportDialogOpen = (state: RootState): boolean =>
  state.export.optimizedDialogOpen;
export const selectExportCommandPreview = (state: RootState): string => state.export.commandPreview;
export const selectExportCommandPreviewError = (state: RootState): AppError | null =>
  state.export.commandPreviewError;
export const selectExportLaunchError = (state: RootState): AppError | null =>
  state.export.launchError;
