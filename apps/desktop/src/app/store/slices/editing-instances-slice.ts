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
import { normalizeSourceKey } from "@/domain/source";
import type { AppError, ExportProgress, ExportResult, MediaInfo } from "@/lib/tauri/media.types";

import type { RootState } from "../store";

export interface EditingInstanceTopologyEntry {
  displayName: string;
  id: EditingInstanceId;
  sourcePath: string;
}

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
      action: PayloadAction<{
        id: EditingInstanceId;
        media?: MediaInfo;
        optimizedArguments?: string;
        snapshot: EditorSnapshot;
      }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      if (!instance) return;
      instance.snapshot = action.payload.snapshot;
      if (action.payload.optimizedArguments !== undefined)
        instance.optimizedArguments = action.payload.optimizedArguments;
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
      action: PayloadAction<{ attempt: ExportAttempt; id: EditingInstanceId }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      if (!instance) return;
      if (instance.exportAttempts.some((attempt) => attempt.id === action.payload.attempt.id))
        return;
      instance.exportAttempts.push(action.payload.attempt);
      instance.draftAvailable = false;
    },
    editingInstanceExportRestored: (
      state,
      action: PayloadAction<{
        attemptId: string;
        id: EditingInstanceId;
        restoredId: EditingInstanceId;
      }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      const attempt = instance && getAttempt(instance, action.payload.attemptId);
      if (
        !instance ||
        !attempt ||
        attempt.state.status === "rendering" ||
        state.entities[action.payload.restoredId]
      )
        return;
      const restored: EditingInstance = {
        id: action.payload.restoredId,
        origin: "duplicate",
        snapshot: attempt.snapshot,
        media: instance.media,
        exportAttempts: [],
        sourceAvailability: instance.sourceAvailability,
        draftAvailable: true,
      };

      if ("resolution" in attempt.request) {
        restored.optimizedArguments = attempt.request.arguments;
        restored.optimizedSettings = {
          resolution: attempt.request.resolution,
          frameRate: attempt.request.frameRate,
        };
      }
      state.ids.push(restored.id);
      state.entities[restored.id] = restored;
      if (attempt.state.status === "queued") {
        instance.exportAttempts = instance.exportAttempts.filter(({ id }) => id !== attempt.id);
      }
    },
    editingInstanceExportStarted: (
      state,
      action: PayloadAction<{ attemptId: string; id: EditingInstanceId; startedAt: number }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      const attempt = instance && getAttempt(instance, action.payload.attemptId);
      if (!attempt || attempt.state.status !== "queued") return;
      attempt.state = {
        startedAt: action.payload.startedAt,
        operationId: null,
        status: "rendering",
      };
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
      if (
        attempt.state.operationId !== null &&
        attempt.state.operationId !== action.payload.progress.operationId
      )
        return;
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
      if (
        attempt.state.operationId !== null &&
        attempt.state.operationId !== action.payload.result.operationId
      )
        return;
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
      if (
        !attempt ||
        attempt.state.status === "completed" ||
        attempt.state.status === "failed" ||
        attempt.state.status === "canceled"
      )
        return;
      attempt.state = {
        canceledAt: Date.now(),
        ...(action.payload.error ? { error: action.payload.error } : {}),
        status: "canceled",
      };
      attempt.metrics.durationMs = action.payload.durationMs;
    },
    editingInstancesSourceAvailabilityChanged: (
      state,
      action: PayloadAction<{ availability: SourceAvailability; sourcePath: string }>,
    ) => {
      for (const instance of Object.values(state.entities)) {
        if (
          instance &&
          normalizeSourceKey(instance.snapshot.source.sourcePath) ===
            normalizeSourceKey(action.payload.sourcePath)
        ) {
          instance.sourceAvailability = action.payload.availability;
        }
      }
    },
    editingInstanceExportHistoryCleared: (
      state,
      action: PayloadAction<EditingInstanceId | undefined>,
    ) => {
      const instances = action.payload
        ? [getInstance(state, action.payload)]
        : Object.values(state.entities);

      for (const instance of instances) {
        if (instance)
          instance.exportAttempts = instance.exportAttempts.filter(
            (attempt) => attempt.state.status === "queued" || attempt.state.status === "rendering",
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
    editingInstancesClosed: (state, action: PayloadAction<EditingInstanceId[]>) => {
      const closingIds = new Set(action.payload);
      state.ids = state.ids.filter((id) => !closingIds.has(id));
      for (const id of closingIds) delete state.entities[id];
      if (state.activeInstanceId && closingIds.has(state.activeInstanceId)) {
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
  editingInstanceExportRestored,
  editingInstanceExportStarted,
  editingInstanceMediaUpdated,
  editingInstanceOptimizedSettingsChanged,
  editingInstancesAdded,
  editingInstancesClosed,
  editingInstanceSnapshotUpdated,
  editingInstancesSourceAvailabilityChanged,
} = editingInstancesSlice.actions;
export const editingInstancesReducer = editingInstancesSlice.reducer;

const selectEditingInstancesState = (state: RootState) => state.editingInstances;
const selectEditingInstanceEntities = (state: RootState) =>
  selectEditingInstancesState(state).entities;

export const selectEditingInstanceIds = (state: RootState): EditingInstanceId[] =>
  selectEditingInstancesState(state).ids;

let lastTopologyEntries: EditingInstanceTopologyEntry[] = [];
export const selectEditingInstanceTopologyEntries = (
  state: RootState,
): EditingInstanceTopologyEntry[] => {
  const ids = selectImportedEditingInstances(state).map(({ id }) => id);
  const entities = selectEditingInstanceEntities(state);
  if (
    lastTopologyEntries.length === ids.length &&
    ids.every((id, index) => {
      const instance = entities[id];
      const previous = lastTopologyEntries[index];
      const source = instance?.snapshot.source;
      return (
        instance?.id === previous?.id &&
        source?.displayName === previous?.displayName &&
        source?.sourcePath === previous?.sourcePath
      );
    })
  ) {
    return lastTopologyEntries;
  }

  lastTopologyEntries = ids.flatMap((id) => {
    const instance = entities[id];
    return instance
      ? [
          {
            displayName: instance.snapshot.source.displayName,
            id,
            sourcePath: instance.snapshot.source.sourcePath,
          },
        ]
      : [];
  });
  return lastTopologyEntries;
};

export const selectEditingInstances = createSelector([selectEditingInstancesState], (state) =>
  state.ids
    .map((id) => state.entities[id])
    .filter((value): value is EditingInstance => Boolean(value)),
);
export const selectImportedEditingInstances = createSelector(
  [selectEditingInstances],
  (instances) => instances.filter((instance) => instance.draftAvailable !== false),
);
export const selectActiveInstanceId = (state: RootState): EditingInstanceId | null =>
  selectEditingInstancesState(state).activeInstanceId;
export const selectEditingInstanceById = (state: RootState, id: EditingInstanceId) =>
  selectEditingInstancesState(state).entities[id];
export const selectActiveEditingInstance = createSelector([selectEditingInstancesState], (state) =>
  state.activeInstanceId ? state.entities[state.activeInstanceId] : undefined,
);
export const selectEditingInstanceAttempts = createSelector([selectEditingInstances], (instances) =>
  instances.flatMap((instance) => instancesToAttempts(instance)),
);
export const selectHasQueuedOrRenderingExportByInstanceId = (
  state: RootState,
  id: EditingInstanceId,
): boolean => {
  return (
    selectEditingInstanceById(state, id)?.exportAttempts.some(
      ({ state }) => state.status === "queued" || state.status === "rendering",
    ) ?? false
  );
};
const selectProcessableExportCount = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids) =>
    ids.reduce((count, id) => count + (hasProcessableExport(entities[id]) ? 1 : 0), 0),
);

export const selectQueuedExportCount = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids) =>
    ids.reduce(
      (count, id) =>
        count +
        (entities[id]?.exportAttempts.filter(({ state }) => state.status === "queued").length ?? 0),
      0,
    ),
);
export const selectHasProcessableExports = createSelector(
  [selectProcessableExportCount],
  (count) => count > 0,
);
export const selectRenderingAttempt = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids) => {
    for (const id of ids) {
      const instance = entities[id];
      const attempt = instance?.exportAttempts.find(({ state }) => state.status === "rendering");
      if (instance && attempt) return { attempt, instance };
    }
    return undefined;
  },
);
export const selectExportQueue = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids) => {
    let active: { attempt: ExportAttempt; instance: EditingInstance } | undefined;
    const pending: { attempt: ExportAttempt; instance: EditingInstance }[] = [];

    for (const id of ids) {
      const instance = entities[id];
      if (!instance) continue;
      for (const attempt of instance.exportAttempts) {
        if (attempt.state.status === "rendering") {
          active ??= { attempt, instance };
        } else if (attempt.state.status === "queued") {
          pending.push({ attempt, instance });
        }
      }
    }

    pending.sort((left, right) => left.attempt.capturedAt - right.attempt.capturedAt);
    return { active, pending };
  },
);
export const selectInstanceIdsBySourceKey = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids) => {
    const sourceIds = new Map<string, EditingInstanceId[]>();
    for (const id of ids) {
      const instance = entities[id];
      if (!instance) continue;
      const key = normalizeSourceKey(instance.snapshot.source.sourcePath);
      const matchingIds = sourceIds.get(key);
      if (matchingIds) matchingIds.push(id);
      else sourceIds.set(key, [id]);
    }
    return sourceIds;
  },
);

function hasProcessableExport(instance: EditingInstance | undefined): boolean {
  return (
    instance?.exportAttempts.some(
      ({ state }) => state.status === "queued" || state.status === "rendering",
    ) ?? false
  );
}

function instancesToAttempts(instance: EditingInstance) {
  return instance.exportAttempts.map((attempt) => ({ attempt, instance }));
}
