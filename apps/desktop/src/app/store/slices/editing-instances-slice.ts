import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared } from "@/app/store/actions/source-actions";
import {
  type EditingInstance,
  type EditingInstanceId,
  type EditingInstanceListEntry,
  type EditingInstanceSearchEntry,
  type EditingInstancesState,
  EMPTY_EXPORT_METRICS,
  type ExportAttempt,
  type ExportAttemptMetrics,
  type ExportSettings,
  type SourceAvailability,
} from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import { normalizeSourceKey } from "@/domain/source";
import type { AppError, ExportProgress, ExportResult, MediaInfo } from "@/lib/tauri/media.types";

import type { RootState } from "../store";

interface EditingInstanceTopologyEntry {
  displayName: string;
  id: EditingInstanceId;
  sourcePath: string;
}

function createStableListSelector<T>(equals: (left: T, right: T) => boolean) {
  let previous: T[] = [];
  return (next: T[]): T[] => {
    if (
      previous.length === next.length &&
      next.every((entry, index) => equals(previous[index]!, entry))
    )
      return previous;
    previous = next;
    return next;
  };
}

const retainListEntries = createStableListSelector<EditingInstanceListEntry>(
  (left, right) =>
    left.id === right.id &&
    left.displayName === right.displayName &&
    left.sourcePath === right.sourcePath &&
    left.fileSizeBytes === right.fileSizeBytes &&
    left.updatedAtMicros === right.updatedAtMicros &&
    left.importedAtMicros === right.importedAtMicros &&
    left.sourceAvailability === right.sourceAvailability,
);

const retainSearchEntries = createStableListSelector<EditingInstanceSearchEntry>(
  (left, right) =>
    left.id === right.id &&
    left.displayName === right.displayName &&
    left.sourcePath === right.sourcePath,
);

const retainImportedIds = createStableListSelector<EditingInstanceId>(
  (left, right) => left === right,
);

export type ExportQueueItem = {
  attempt: ExportAttempt;
  instance: EditingInstance;
};

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
    },
    editingInstanceExportAttemptRemoved: (
      state,
      action: PayloadAction<{ attemptId: string; id: EditingInstanceId }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      if (instance) {
        instance.exportAttempts = instance.exportAttempts.filter(
          ({ id }) => id !== action.payload.attemptId,
        );
      }
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
    editingInstanceExportRequeued: (
      state,
      action: PayloadAction<{ attemptId: string; id: EditingInstanceId }>,
    ) => {
      const instance = getInstance(state, action.payload.id);
      const attempt = instance && getAttempt(instance, action.payload.attemptId);
      if (!attempt || attempt.state.status !== "rendering") return;
      attempt.metrics = {
        ...EMPTY_EXPORT_METRICS,
        ...(attempt.metrics.totalFrames === undefined
          ? {}
          : { totalFrames: attempt.metrics.totalFrames }),
      };
      attempt.state = { queuedAt: Date.now(), status: "queued" };
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
      const instance = state.entities[action.payload];
      const index = state.ids.indexOf(action.payload);
      if (index < 0 || !instance) return;
      if (hasProcessableExport(instance)) {
        instance.draftAvailable = false;
        if (state.activeInstanceId === action.payload) state.activeInstanceId = null;
        return;
      }
      state.ids.splice(index, 1);
      delete state.entities[action.payload];
      if (state.activeInstanceId === action.payload) {
        state.activeInstanceId = null;
      }
    },
    editingInstancesClosed: (state, action: PayloadAction<EditingInstanceId[]>) => {
      const closingIds = new Set(action.payload);
      const retainedQueueOwners = new Set<EditingInstanceId>();
      for (const id of closingIds) {
        const instance = state.entities[id];
        if (instance && hasProcessableExport(instance)) {
          instance.draftAvailable = false;
          retainedQueueOwners.add(id);
        } else {
          delete state.entities[id];
        }
      }
      state.ids = state.ids.filter((id) => !closingIds.has(id) || retainedQueueOwners.has(id));
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

const {
  activeEditingInstanceChanged,
  editingInstanceClosed,
  editingInstanceDuplicated,
  editingInstanceExportAttemptQueued,
  editingInstanceExportAttemptRemoved,
  editingInstanceExportCanceled,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportHistoryCleared,
  editingInstanceExportProgressReceived,
  editingInstanceExportRequeued,
  editingInstanceExportRestored,
  editingInstanceExportStarted,
  editingInstanceMediaUpdated,
  editingInstanceOptimizedSettingsChanged,
  editingInstancesAdded,
  editingInstancesClosed,
  editingInstanceSnapshotUpdated,
  editingInstancesSourceAvailabilityChanged,
} = editingInstancesSlice.actions;

const editingInstancesReducer = editingInstancesSlice.reducer;

const selectEditingInstancesState = (state: RootState) => state.editingInstances;
const selectEditingInstanceEntities = (state: RootState) =>
  selectEditingInstancesState(state).entities;

const selectEditingInstanceIds = (state: RootState): EditingInstanceId[] =>
  selectEditingInstancesState(state).ids;

let lastTopologyEntries: EditingInstanceTopologyEntry[] = [];
const selectEditingInstanceTopologyEntries = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids): EditingInstanceTopologyEntry[] => {
    const importedIds = ids.filter((id) => entities[id]?.draftAvailable !== false);
    if (
      lastTopologyEntries.length === importedIds.length &&
      importedIds.every((id, index) => {
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

    lastTopologyEntries = importedIds.flatMap((id) => {
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
  },
);

const selectSourceListEntries = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids): EditingInstanceListEntry[] => {
    const entries: EditingInstanceListEntry[] = [];

    for (const id of ids) {
      const instance = entities[id];
      if (!instance || instance.draftAvailable === false) continue;
      const source = instance.snapshot.source;
      entries.push({
        displayName: source.displayName,
        ...(source.fileSizeBytes === undefined ? {} : { fileSizeBytes: source.fileSizeBytes }),
        id,
        ...(instance.importedAtMicros === undefined
          ? {}
          : { importedAtMicros: instance.importedAtMicros }),
        sourceAvailability: instance.sourceAvailability,
        sourcePath: source.sourcePath,
        ...(source.updatedAtMicros === undefined
          ? {}
          : { updatedAtMicros: source.updatedAtMicros }),
      });
    }

    return retainListEntries(entries);
  },
);

const selectSourceSearchEntries = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids): EditingInstanceSearchEntry[] => {
    const entries: EditingInstanceSearchEntry[] = [];

    for (const id of ids) {
      const instance = entities[id];
      if (!instance || instance.draftAvailable === false) continue;
      entries.push({
        displayName: instance.snapshot.source.displayName,
        id,
        sourcePath: instance.snapshot.source.sourcePath,
      });
    }

    return retainSearchEntries(entries);
  },
);

const selectImportedEditingInstanceIds = createSelector(
  [selectEditingInstanceEntities, selectEditingInstanceIds],
  (entities, ids) => retainImportedIds(ids.filter((id) => entities[id]?.draftAvailable !== false)),
);

const selectEditingInstances = createSelector([selectEditingInstancesState], (state) =>
  state.ids
    .map((id) => state.entities[id])
    .filter((value): value is EditingInstance => Boolean(value)),
);

const selectImportedEditingInstances = createSelector([selectEditingInstances], (instances) =>
  instances.filter((instance) => instance.draftAvailable !== false),
);

const selectActiveInstanceId = (state: RootState): EditingInstanceId | null =>
  selectEditingInstancesState(state).activeInstanceId;

const selectEditingInstanceById = (state: RootState, id: EditingInstanceId) =>
  selectEditingInstancesState(state).entities[id];

const selectActiveEditingInstance = createSelector([selectEditingInstancesState], (state) =>
  state.activeInstanceId ? state.entities[state.activeInstanceId] : undefined,
);

const selectEditingInstanceAttempts = createSelector([selectEditingInstances], (instances) =>
  instances.flatMap((instance) => instancesToAttempts(instance)),
);

const selectHasQueuedOrRenderingExportByInstanceId = (
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

const selectHasProcessableExports = createSelector(
  [selectProcessableExportCount],
  (count) => count > 0,
);

const selectRenderingAttempt = createSelector(
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

const selectExportQueue = createSelector([selectEditingInstances], (instances): ExportQueueItem[] =>
  instances
    .flatMap((instance) => instancesToAttempts(instance))
    .sort((left, right) => left.attempt.capturedAt - right.attempt.capturedAt),
);

const selectExportQueueById = createSelector(
  [selectExportQueue, (_state: RootState, id: EditingInstanceId) => id],
  (queue, id) => queue.filter(({ instance }) => instance.id === id),
);

const selectInstanceIdsBySourceKey = createSelector(
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

export {
  activeEditingInstanceChanged,
  editingInstanceClosed,
  editingInstanceDuplicated,
  editingInstanceExportAttemptQueued,
  editingInstanceExportAttemptRemoved,
  editingInstanceExportCanceled,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportHistoryCleared,
  editingInstanceExportProgressReceived,
  editingInstanceExportRequeued,
  editingInstanceExportRestored,
  editingInstanceExportStarted,
  editingInstanceMediaUpdated,
  editingInstanceOptimizedSettingsChanged,
  editingInstancesAdded,
  editingInstancesClosed,
  editingInstanceSnapshotUpdated,
  editingInstancesReducer,
  editingInstancesSourceAvailabilityChanged,
  selectActiveEditingInstance,
  selectActiveInstanceId,
  selectEditingInstanceAttempts,
  selectEditingInstanceById,
  selectEditingInstanceIds,
  selectEditingInstances,
  selectEditingInstanceTopologyEntries,
  selectExportQueue,
  selectExportQueueById,
  selectHasProcessableExports,
  selectHasQueuedOrRenderingExportByInstanceId,
  selectImportedEditingInstanceIds,
  selectImportedEditingInstances,
  selectInstanceIdsBySourceKey,
  selectRenderingAttempt,
  selectSourceListEntries,
  selectSourceSearchEntries,
};

export type { EditingInstanceTopologyEntry };
