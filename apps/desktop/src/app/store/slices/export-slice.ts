import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { queueSettingsReset } from "@/app/store/actions/queue-actions";
import { sourceCleared } from "@/app/store/actions/source-actions";
import { selectExportQueueById } from "@/app/store/slices/editing-instances-slice";
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
    builder.addCase(queueSettingsReset, (state) => {
      state.queueFinishAction = state.availableQueueFinishActions.includes("nothing")
        ? "nothing"
        : (state.availableQueueFinishActions[0] ?? "nothing");
    });
    builder.addCase(sourceCleared, (state) => {
      state.optimizedDialogOpen = false;
      state.optimizedPlanRequestId = null;
      state.commandPreview = "";
      state.commandPreviewError = null;
      state.launchError = null;
    });
  },
});

const {
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

const exportReducer = exportSlice.reducer;

const selectSourceQueueStarted = (state: RootState, instanceId: string): boolean =>
  state.export.startedSourceIds.includes(instanceId);

const selectSourceExportQueueState = createSelector(
  [selectExportQueueById, selectSourceQueueStarted],
  (items, started) => ({
    hasExports: items.length > 0,
    hasQueuedExports: items.some(({ attempt }) => attempt.state.status === "queued"),
    isRunning: started || items.some(({ attempt }) => attempt.state.status === "rendering"),
  }),
);

const selectQueueFinishAction = (state: RootState): QueueFinishAction =>
  state.export.queueFinishAction;

const selectAvailableQueueFinishActions = (state: RootState): QueueFinishAction[] =>
  state.export.availableQueueFinishActions;

const selectOptimizedExportDialogOpen = (state: RootState): boolean =>
  state.export.optimizedDialogOpen;

const selectExportCommandPreview = (state: RootState): string => state.export.commandPreview;
const selectExportCommandPreviewError = (state: RootState): AppError | null =>
  state.export.commandPreviewError;

const selectExportLaunchError = (state: RootState): AppError | null => state.export.launchError;

export {
  exportLaunchFailed,
  exportReducer,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  queueFinishActionChanged,
  queueFinishActionsAvailable,
  queuePaused,
  queueStarted,
  selectAvailableQueueFinishActions,
  selectExportCommandPreview,
  selectExportCommandPreviewError,
  selectExportLaunchError,
  selectOptimizedExportDialogOpen,
  selectQueueFinishAction,
  selectSourceExportQueueState,
  selectSourceQueueStarted,
};
