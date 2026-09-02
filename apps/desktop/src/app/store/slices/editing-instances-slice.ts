import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared } from "@/app/store/actions/source-actions";
import type {
  EditingInstance,
  EditingInstanceId,
  EditingInstancesState,
  ExportAttempt,
  ExportAttemptMetrics,
  ExportSettings,
  SourceAvailability,
} from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import type { ExportProgress, ExportResult, MediaInfo, AppError } from "@/lib/tauri/media.types";

import type { RootState } from "../store";

export const initialEditingInstancesState: EditingInstancesState = {
  activeInstanceId: null,
  entities: {},
  ids: [],
};

function getInstance(state: EditingInstancesState, id: EditingInstanceId) {
  return state.entities[id];
}

function getAttempt(instance: EditingInstance, attemptId: string): ExportAttempt | undefined {
  return instance.exportAttempts.find((attempt) => attempt.id === attemptId);
}

const editingInstancesSlice = createSlice({
  name: "editingInstances",
  initialState: initialEditingInstancesState,
  reducers: {
    editingInstancesAdded: (state, action: PayloadAction<EditingInstance[]>) => {
      for (const instance of action.payload) {
        if (state.entities[instance.id]) continue;
        state.ids.push(instance.id);
        state.entities[instance.id] = instance;
      }
    },
    editingInstanceDuplicated: (state, action: PayloadAction<EditingInstance>) => {
      if (state.entities[action.payload.id]) return;
      state.ids.push(action.payload.id);
      state.entities[action.payload.id] = action.payload;
    },
    editingInstanceMediaUpdated: (
      state,
      action: PayloadAction<{ id: EditingInstanceId; media: MediaInfo }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      if (instance) instance.media = action.payload.media;
    },
    editingInstanceSnapshotUpdated: (
      state,
      action: PayloadAction<{ id: EditingInstanceId; media?: MediaInfo; snapshot: EditorSnapshot }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      if (!instance) return;
      instance.snapshot = action.payload.snapshot;
      if (action.payload.media) instance.media = action.payload.media;
    },
    activeEditingInstanceChanged: (state, action: PayloadAction<EditingInstanceId | null>) => {
      state.activeInstanceId = action.payload;
    },
    editingInstanceOptimizedSettingsChanged: (
      state,
      action: PayloadAction<{ id: EditingInstanceId; settings: ExportSettings }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      if (instance) instance.optimizedSettings = action.payload.settings;
    },
    editingInstanceExportAttemptQueued: (
      state,
      action: PayloadAction<{ id: EditingInstanceId; attempt: ExportAttempt }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      if (!instance) return;
      if (
        instance.exportAttempts.some(
          (attempt) => attempt.state.status === "queued" || attempt.state.status === "rendering",
        )
      )
        return;
      instance.exportAttempts.push(action.payload.attempt);
    },
    editingInstanceExportStarted: (
      state,
      action: PayloadAction<{ attemptId: string; id: EditingInstanceId; startedAt: number }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      const attempt = instance && getAttempt(instance, action.payload.attemptId);
      if (!attempt || attempt.state.status !== "queued") return;
      attempt.state = { startedAt: action.payload.startedAt, operationId: null, status: "rendering" };
    },
    editingInstanceExportProgressReceived: (
      state,
      action: PayloadAction<{
        attemptId: string;
        id: EditingInstanceId;
        metrics: Partial<ExportAttemptMetrics>;
        progress: ExportProgress;
      }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      const attempt = instance && getAttempt(instance, action.payload.attemptId);
      if (!attempt || attempt.state.status !== "rendering") return;
      attempt.state.operationId = action.payload.progress.operationId;
      Object.assign(attempt.metrics, action.payload.metrics);
    },
    editingInstanceExportCompleted: (
      state,
      action: PayloadAction<{
        attemptId: string;
        durationMs: number | null;
        id: EditingInstanceId;
        result: ExportResult;
      }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      const attempt = instance && getAttempt(instance, action.payload.attemptId);
      if (!attempt || attempt.state.status !== "rendering") return;
      attempt.state = {
        completedAt: Date.now(),
        result: action.payload.result,
        status: "completed",
      };
      attempt.metrics.durationMs = action.payload.durationMs;
      attempt.metrics.progressPercent = 100;
    },
    editingInstanceExportFailed: (
      state,
      action: PayloadAction<{
        attemptId: string;
        durationMs: number | null;
        error: AppError;
        id: EditingInstanceId;
      }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      const attempt = instance && getAttempt(instance, action.payload.attemptId);
      if (!attempt || attempt.state.status !== "rendering") return;
      attempt.state = { error: action.payload.error, failedAt: Date.now(), status: "failed" };
      attempt.metrics.durationMs = action.payload.durationMs;
    },
    editingInstanceExportCanceled: (
      state,
      action: PayloadAction<{
        attemptId: string;
        durationMs: number | null;
        error?: AppError;
        id: EditingInstanceId;
      }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      const attempt = instance && getAttempt(instance, action.payload.attemptId);
      if (!attempt || attempt.state.status === "completed" || attempt.state.status === "failed") return;
      attempt.state = {
        canceledAt: Date.now(),
        ...(action.payload.error ? { error: action.payload.error } : {}),
        status: "canceled",
      };
      attempt.metrics.durationMs = action.payload.durationMs;
    },
    editingInstancesSourceAvailabilityChanged: (
      state,
      action: PayloadAction<{ sourcePath: string; availability: SourceAvailability }>,
    ) => {
      for (const instance of Object.values(state.entities)) {
        if (instance?.snapshot.source.sourcePath === action.payload.sourcePath) {
          instance.sourceAvailability = action.payload.availability;
        }
      }
    },
    editingInstanceExportHistoryCleared: (state, action: PayloadAction<EditingInstanceId | undefined>) => {
      const instances = action.payload
        ? [getInstance(state, action.payload)]
        : Object.values(state.entities);
      for (const instance of instances) {
        if (instance) instance.exportAttempts = instance.exportAttempts.filter((attempt) =>
          attempt.state.status === "queued" || attempt.state.status === "rendering",
        );
      }
    },
    editingInstanceClosed: (state, action: PayloadAction<EditingInstanceId>) => {
      const index = state.ids.indexOf(action.payload);
      if (index < 0) return;
      state.ids.splice(index, 1);
      delete state.entities[action.payload];
      if (state.activeInstanceId === action.payload) {
        state.activeInstanceId = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(editingInstanceActivated, (state, action) => {
        const instance = getInstance(state, action.payload.id);
        if (!instance) return;
        state.activeInstanceId = action.payload.id;
        instance.snapshot = action.payload.snapshot;
        if (action.payload.media) instance.media = action.payload.media;
      })
      .addCase(sourceCleared, (state) => {
        state.activeInstanceId = null;
      });
  },
});

export const {
  activeEditingInstanceChanged,
  editingInstanceClosed,
  editingInstanceDuplicated,
  editingInstanceExportAttemptQueued,
  editingInstanceExportCanceled,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportHistoryCleared,
  editingInstanceExportProgressReceived,
  editingInstanceExportStarted,
  editingInstanceMediaUpdated,
  editingInstanceOptimizedSettingsChanged,
  editingInstanceSnapshotUpdated,
  editingInstancesAdded,
  editingInstancesSourceAvailabilityChanged,
} = editingInstancesSlice.actions;
export const editingInstancesReducer = editingInstancesSlice.reducer;

const selectEditingInstancesState = (state: RootState) => state.editingInstances;
export const selectEditingInstanceIds = (state: RootState) => selectEditingInstancesState(state).ids;
export const selectEditingInstances = createSelector(
  [selectEditingInstancesState],
  (state) => state.ids.map((id) => state.entities[id]).filter((value): value is EditingInstance => Boolean(value)),
);
export const selectActiveInstanceId = (state: RootState): EditingInstanceId | null =>
  selectEditingInstancesState(state).activeInstanceId;
export const selectEditingInstanceById = (state: RootState, id: EditingInstanceId) =>
  selectEditingInstancesState(state).entities[id];
export const selectActiveEditingInstance = createSelector(
  [selectEditingInstancesState],
  (state) => (state.activeInstanceId ? state.entities[state.activeInstanceId] : undefined),
);
export const selectActiveEditingInstanceSnapshot = createSelector(
  [selectActiveEditingInstance],
  (instance) => instance?.snapshot,
);
export const selectEditingInstanceAttempts = createSelector(
  [selectEditingInstances],
  (instances) => instances.flatMap((instance) => instancesToAttempts(instance)),
);
export const selectHasProcessableExports = createSelector(
  [selectEditingInstanceAttempts],
  (attempts) => attempts.some(({ attempt }) => attempt.state.status === "queued" || attempt.state.status === "rendering"),
);
export const selectRenderingAttempt = createSelector(
  [selectEditingInstanceAttempts],
  (attempts) => attempts.find(({ attempt }) => attempt.state.status === "rendering"),
);

function instancesToAttempts(instance: EditingInstance) {
  return instance.exportAttempts.map((attempt) => ({ attempt, instance }));
}
