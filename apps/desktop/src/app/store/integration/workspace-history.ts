import {
  createEditorSnapshotFromState,
  historyProjection,
} from "@/app/store/integration/editor-snapshot";
import { hasActiveExportForSource } from "@/app/store/integration/export-queue-runtime";
import {
  audioTrackDefaultChanged,
  audioTrackFiltersApplied,
  audioTrackMetadataChanged,
  audioTrackToggled,
  audioTrackVolumeChanged,
} from "@/app/store/slices/audio-slice";
import {
  chapterAdded,
  chapterDeleted,
  chapterUpdated,
  selectChapters,
} from "@/app/store/slices/chapters-slice";
import {
  cropChanged,
  cropResolutionFor,
  flipToggled,
  rotationChanged,
} from "@/app/store/slices/crop-slice";
import {
  editingInstanceGifSettingsChanged,
  editingInstanceOptimizedSettingsChanged,
  editingInstancesLifecycleChanged,
  editingInstanceSnapshotUpdated,
  editingInstancesSourceAvailabilityChanged,
  selectActiveInstanceId,
  selectHasQueuedOrRenderingExportByInstanceId,
  selectInstanceIdsBySourceKey,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import {
  historyReplayFinished,
  historyReplayStarted,
  selectWorkspaceHistory,
} from "@/app/store/slices/workspace-history-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import type { AudioTrackSettings } from "@/domain/audio-processing";
import type { EditingInstance } from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import { normalizeSourceKey } from "@/domain/source";
import { createFullTrimRange } from "@/domain/trim";
import type {
  HistoryChange,
  HistoryOperation,
  HistorySlot,
  HistoryTarget,
} from "@/domain/workspace-history";
import { moveSourceToTrash, restoreSourceFromTrash } from "@/lib/tauri/media";

type Dispatch = AppDispatch;
function editorProjection(snapshot: EditorSnapshot) {
  return historyProjection(snapshot);
}
function currentSnapshot(state: RootState, id: string): EditorSnapshot | undefined {
  const instance = state.editingInstances.entities[id];
  if (!instance) return undefined;
  if (state.editingInstances.activeInstanceId === id && state.source.source)
    return createEditorSnapshotFromState(state, state.source.source) ?? instance.snapshot;
  return instance.snapshot;
}
function valueOf(slot: HistorySlot): unknown {
  return slot.present ? slot.value : undefined;
}
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function applyChange(
  snapshot: EditorSnapshot,
  change: HistoryChange,
  direction: "undo" | "redo",
): EditorSnapshot {
  const field = change.field;
  const value = valueOf(direction === "undo" ? change.before : change.after);
  const next = { ...snapshot } as EditorSnapshot & Record<string, unknown>;
  if (field === "trim") next.trim = value as EditorSnapshot["trim"];
  else if (field === "crop") next.crop = value as EditorSnapshot["crop"];
  else if (field === "rotation") next.rotation = value as EditorSnapshot["rotation"];
  else if (field === "flipHorizontal") next.flipHorizontal = value as boolean;
  else if (field === "flipVertical") next.flipVertical = value as boolean;
  else if (field.startsWith("audio:")) {
    const streamIndex = Number(field.slice("audio:".length));
    const tracks = snapshot.audio.tracks.filter((track) => track.streamIndex !== streamIndex);
    if (value !== undefined) tracks.push(value as AudioTrackSettings);
    next.audio = { tracks: tracks.sort((a, b) => a.streamIndex - b.streamIndex) };
  } else if (field.startsWith("chapter:")) {
    const id = field.slice("chapter:".length);
    const chapters = (snapshot.chapters ?? []).filter((chapter) => chapter.id !== id);
    if (value !== undefined)
      chapters.push(value as NonNullable<EditorSnapshot["chapters"]>[number]);
    next.chapters = chapters.sort((a, b) => a.startMicros - b.startMicros);
  }
  return next;
}
function restoreActiveField(
  dispatch: Dispatch,
  getState: () => RootState,
  field: string,
  snapshot: EditorSnapshot,
  target: HistoryTarget,
) {
  if (target.kind !== "instance" || selectActiveInstanceId(getState()) !== target.instanceId)
    return;
  const state = getState();
  const instance = state.editingInstances.entities[target.instanceId];
  if (!instance) return;
  if (field === "trim") {
    const duration = instance.media?.durationMicros;
    if (duration) {
      const trim =
        "kind" in snapshot.trim
          ? createFullTrimRange(duration)
          : {
              startMicros: snapshot.trim.startMicros,
              endMicros: snapshot.trim.endMicros,
              sourceDurationMicros: duration,
            };

      dispatch(trimChanged({ trim }));
    }
  } else if (field === "rotation") {
    dispatch(rotationChanged(snapshot.rotation ?? 0));
  } else if (
    field === "flipHorizontal" &&
    state.crop.flipHorizontal !== (snapshot.flipHorizontal ?? false)
  ) {
    dispatch(flipToggled("horizontal"));
  } else if (
    field === "flipVertical" &&
    state.crop.flipVertical !== (snapshot.flipVertical ?? false)
  ) {
    dispatch(flipToggled("vertical"));
  } else if (field === "crop") {
    const resolution = cropResolutionFor(
      instance.media?.video ?? null,
      snapshot.crop ?? { x: 0, y: 0, width: 1, height: 1 },
      snapshot.rotation ?? 0,
    );

    dispatch(
      cropChanged({ crop: snapshot.crop ?? { x: 0, y: 0, width: 1, height: 1 }, resolution }),
    );
  } else if (field.startsWith("audio:")) {
    const streamIndex = Number(field.slice("audio:".length));
    const desired = snapshot.audio.tracks.find((track) => track.streamIndex === streamIndex);
    const previous = state.audio.tracks;
    const track = previous.find((candidate) => candidate.streamIndex === streamIndex);
    if (!track || !desired) return;
    if (track.enabled !== desired.enabled) dispatch(audioTrackToggled({ streamIndex }));
    if (track.metadata.isDefault !== desired.metadata.isDefault && desired.metadata.isDefault)
      dispatch(audioTrackDefaultChanged({ streamIndex }));
    if (
      track.metadata.title !== desired.metadata.title ||
      track.metadata.language !== desired.metadata.language
    )
      dispatch(
        audioTrackMetadataChanged({
          streamIndex,
          title: desired.metadata.title,
          language: desired.metadata.language,
        }),
      );
    if (track.processing.volume !== desired.processing.volume)
      dispatch(audioTrackVolumeChanged({ streamIndex, volume: desired.processing.volume }));
    if (!equal(track.processing.filters, desired.processing.filters))
      dispatch(audioTrackFiltersApplied({ streamIndex, filters: desired.processing.filters }));
  } else if (field.startsWith("chapter:")) {
    const chapterId = field.slice("chapter:".length);
    const existing = selectChapters(state).find((chapter) => chapter.id === chapterId);
    const desired = snapshot.chapters?.find((chapter) => chapter.id === chapterId);
    if (existing && !desired) dispatch(chapterDeleted(chapterId));
    else if (desired && !existing) dispatch(chapterAdded(desired));
    else if (existing && desired && !equal(existing, desired)) dispatch(chapterUpdated(desired));
  } else if (field === "chapters") {
    const current = selectChapters(state);
    for (const chapter of current)
      if (!snapshot.chapters?.some((next) => next.id === chapter.id))
        dispatch(chapterDeleted(chapter.id));
    for (const chapter of snapshot.chapters ?? []) {
      const existing = current.find((item) => item.id === chapter.id);
      if (!existing) dispatch(chapterAdded(chapter));
      else if (!equal(existing, chapter)) dispatch(chapterUpdated(chapter));
    }
  }
}

type StateHistoryOperation = Extract<HistoryOperation, { kind: "state" }>;
type ExternalHistoryOperation = Extract<HistoryOperation, { kind: "external" }>;

interface StateReplayCheckpoint {
  activeInstanceId: string | null;
  instances: Array<{
    index: number;
    instance: EditingInstance;
    snapshot: EditorSnapshot;
  }>;
  operation: StateHistoryOperation;
  type: "state";
}

interface ExternalReplayCheckpoint {
  direction: "undo" | "redo";
  operation: ExternalHistoryOperation;
  type: "external";
}

type ReplayCheckpoint = StateReplayCheckpoint | ExternalReplayCheckpoint;

class HistoryReplayRejected extends Error {
  constructor() {
    super("Workspace history transition was rejected");
    this.name = "HistoryReplayRejected";
  }
}

function captureStateReplayCheckpoint(
  state: RootState,
  operation: StateHistoryOperation,
): StateReplayCheckpoint {
  const ids = new Set(
    operation.changes.flatMap((change) =>
      change.target.kind === "instance" ? [change.target.instanceId] : [],
    ),
  );

  const instances = [...ids].map((id) => {
    const instance = state.editingInstances.entities[id];
    const snapshot = instance && currentSnapshot(state, id);
    const index = state.editingInstances.ids.indexOf(id);
    if (!instance || !snapshot || index < 0)
      throw new Error(`Cannot checkpoint missing Editing Instance ${id}`);
    return { index, instance: structuredClone({ ...instance, snapshot }), snapshot };
  });

  return {
    activeInstanceId: selectActiveInstanceId(state),
    instances,
    operation,
    type: "state",
  };
}

async function applyStateOperation(
  dispatch: Dispatch,
  getState: () => RootState,
  operation: StateHistoryOperation,
  direction: "undo" | "redo",
  includeNavigation: boolean,
) {
  if (!includeNavigation && operation.role === "navigation") return;
  const orderedChanges = [...operation.changes].sort((a, b) => {
    const priority = (change: HistoryChange) =>
      change.field === "rotation" ? 0 : change.field === "crop" ? 1 : 2;

    return priority(a) - priority(b);
  });

  const snapshots = new Map<string, EditorSnapshot>();
  for (const change of orderedChanges) {
    if (change.target.kind !== "instance") continue;
    const instance = getState().editingInstances.entities[change.target.instanceId];
    const snapshot =
      snapshots.get(change.target.instanceId) ??
      currentSnapshot(getState(), change.target.instanceId) ??
      instance?.snapshot;

    if (!snapshot)
      throw new Error(`Cannot replay missing Editing Instance ${change.target.instanceId}`);
    const next = applyChange(snapshot, change, direction);
    snapshots.set(change.target.instanceId, next);
    restoreActiveField(dispatch, getState, change.field, next, change.target);
  }
  for (const [id, snapshot] of snapshots) {
    dispatch(editingInstanceSnapshotUpdated({ id, snapshot }));
    const instance = getState().editingInstances.entities[id];
    const transformChanged = operation.changes.some(
      (change) =>
        change.target.kind === "instance" &&
        change.target.instanceId === id &&
        (change.field === "crop" || change.field === "rotation"),
    );

    if (instance?.media && transformChanged && id !== selectActiveInstanceId(getState())) {
      const resolution = cropResolutionFor(
        instance.media.video ?? null,
        snapshot.crop ?? { x: 0, y: 0, width: 1, height: 1 },
        snapshot.rotation ?? 0,
      );

      dispatch(
        editingInstanceOptimizedSettingsChanged({
          id,
          settings: { frameRate: instance.optimizedSettings?.frameRate, resolution },
        }),
      );
      if (instance.gifSettings) {
        dispatch(
          editingInstanceGifSettingsChanged({
            id,
            settings: { ...instance.gifSettings, resolution },
          }),
        );
      }
    }
  }
  for (const change of operation.changes) {
    if (change.target.kind !== "workspace" || change.field !== "activeInstanceId") continue;
    const slot = direction === "undo" ? change.before : change.after;
    const id = slot.present && typeof slot.value === "string" ? slot.value : null;
    if (id === selectActiveInstanceId(getState())) continue;
    if (!(await dispatch(navigateToEditingInstance(id)))) throw new HistoryReplayRejected();
  }
}

async function restoreStateReplayCheckpoint(
  dispatch: Dispatch,
  getState: () => RootState,
  checkpoint: StateReplayCheckpoint,
) {
  for (const previous of checkpoint.instances) {
    const current = getState().editingInstances.entities[previous.instance.id];
    if (!current)
      throw new Error(`Cannot restore missing Editing Instance ${previous.instance.id}`);
    dispatch(
      editingInstancesLifecycleChanged({
        instances: [{ index: previous.index, instance: previous.instance }],
        removeIds: [],
      }),
    );
    for (const change of checkpoint.operation.changes) {
      if (change.target.kind === "instance" && change.target.instanceId === previous.instance.id)
        restoreActiveField(dispatch, getState, change.field, previous.snapshot, change.target);
    }
  }
  if (selectActiveInstanceId(getState()) !== checkpoint.activeInstanceId) {
    if (!(await dispatch(navigateToEditingInstance(checkpoint.activeInstanceId))))
      throw new Error("Active Editing Instance checkpoint restoration was rejected");
  }
}

function applyHistoryPosition(
  position: number,
  includeNavigation = true,
  activateInstanceId?: string,
) {
  return async (dispatch: Dispatch, getState: () => RootState): Promise<boolean> => {
    const state = getState();
    const history = selectWorkspaceHistory(state);
    if (
      state.workspaceHistory.replaying ||
      state.workspaceHistory.interaction ||
      position < 0 ||
      position > history.operations.length ||
      position === history.position
    )
      return false;
    const direction: "undo" | "redo" = position < history.position ? "undo" : "redo";
    const ordered = history.operations.slice(
      Math.min(position, history.position),
      Math.max(position, history.position),
    );

    if (direction === "undo") ordered.reverse();
    const steps = ordered.flatMap((operation) =>
      operation.kind === "information" ? [] : [{ operation, direction }],
    );

    const simulated = new Map<string, { snapshot: EditorSnapshot; sourceId: string }>();
    for (const id of state.editingInstances.ids) {
      const instance = state.editingInstances.entities[id];
      const snapshot = instance && currentSnapshot(state, id);
      if (instance && snapshot)
        simulated.set(id, { snapshot, sourceId: instance.snapshot.source.sourcePath });
    }
    for (const { direction: stepDirection, operation } of steps) {
      if (operation.kind === "external" && operation.type === "instances.lifecycle") {
        const payload = operation.payload as unknown as {
          after: Array<{
            index: number;
            instance: import("@/domain/editing-instance").EditingInstance;
          }>;
          before: Array<{
            index: number;
            instance: import("@/domain/editing-instance").EditingInstance;
          }>;
        };

        const beforeIds = payload.before.map(({ instance }) => instance.id);
        const afterIds = payload.after.map(({ instance }) => instance.id);
        const desired = stepDirection === "undo" ? payload.before : payload.after;
        for (const id of [...beforeIds, ...afterIds]) simulated.delete(id);
        for (const { instance } of desired)
          simulated.set(instance.id, {
            snapshot: instance.snapshot,
            sourceId: instance.snapshot.source.sourcePath,
          });
        continue;
      }
      if (operation.kind !== "state") continue;
      if (!includeNavigation && operation.role === "navigation") continue;
      for (const change of operation.changes) {
        if (change.target.kind === "workspace" && change.field === "activeInstanceId") continue;
        if (change.target.kind !== "instance") return false;
        const current = simulated.get(change.target.instanceId);
        if (
          !current ||
          normalizeSourceKey(current.sourceId) !== normalizeSourceKey(change.target.sourceId) ||
          normalizeSourceKey(current.snapshot.source.sourcePath) !==
            normalizeSourceKey(change.target.sourceId)
        )
          return false;
        const projection = editorProjection(current.snapshot) as Record<string, unknown>;
        const expected = valueOf(stepDirection === "undo" ? change.after : change.before);
        const isFullSourceTrimBaseline =
          change.field === "trim" &&
          projection.trim !== null &&
          typeof projection.trim === "object" &&
          "kind" in projection.trim &&
          projection.trim.kind === "full-source" &&
          expected !== null &&
          typeof expected === "object" &&
          "startMicros" in expected &&
          expected.startMicros === 0;

        if (!equal(projection[change.field], expected) && !isFullSourceTrimBaseline) return false;
        simulated.set(change.target.instanceId, {
          ...current,
          snapshot: applyChange(current.snapshot, change, stepDirection),
        });
      }
    }
    const activeInstanceId = selectActiveInstanceId(state);
    const applied: ReplayCheckpoint[] = [];
    try {
      dispatch(historyReplayStarted());
      for (const { direction: stepDirection, operation } of steps) {
        if (operation.kind === "external") {
          const externalApplied = await applyExternalOperation(
            dispatch,
            getState,
            operation,
            stepDirection,
          );

          if (!externalApplied) throw new HistoryReplayRejected();
          applied.push({ direction: stepDirection, operation, type: "external" });
          continue;
        }
        if (operation.kind !== "state") continue;
        if (!includeNavigation && operation.role === "navigation") continue;
        const checkpoint = captureStateReplayCheckpoint(getState(), operation);
        applied.push(checkpoint);
        await applyStateOperation(dispatch, getState, operation, stepDirection, includeNavigation);
      }

      if (
        activateInstanceId &&
        activateInstanceId !== selectActiveInstanceId(getState()) &&
        getState().editingInstances.entities[activateInstanceId]?.sourceAvailability ===
          "available" &&
        getState().editingInstances.entities[activateInstanceId]?.draftAvailable !== false
      ) {
        const activated = await dispatch(navigateToEditingInstance(activateInstanceId));
        if (!activated) throw new HistoryReplayRejected();
      }
      dispatch(historyReplayFinished({ position }));
      return true;
    } catch (error) {
      const compensationErrors: unknown[] = [];
      for (const checkpoint of applied.reverse()) {
        try {
          if (checkpoint.type === "state") {
            await restoreStateReplayCheckpoint(dispatch, getState, checkpoint);
          } else {
            const restored = await applyExternalOperation(
              dispatch,
              getState,
              checkpoint.operation,
              checkpoint.direction === "undo" ? "redo" : "undo",
            );

            if (!restored) throw new Error("History operation compensation was rejected");
          }
        } catch (compensationError) {
          compensationErrors.push(compensationError);
        }
      }
      if (selectActiveInstanceId(getState()) !== activeInstanceId) {
        try {
          const restored = await dispatch(navigateToEditingInstance(activeInstanceId));
          if (!restored) throw new Error("Active Editing Instance compensation was rejected");
        } catch (compensationError) {
          compensationErrors.push(compensationError);
        }
      }
      dispatch(historyReplayFinished({ position: history.position }));
      if (compensationErrors.length)
        throw new AggregateError(
          [error, ...compensationErrors],
          "Workspace history replay failed and rollback was incomplete",
          { cause: error },
        );
      if (error instanceof HistoryReplayRejected) return false;
      throw error;
    }
  };
}

async function applyExternalOperation(
  dispatch: Dispatch,
  getState: () => RootState,
  operation: Extract<HistoryOperation, { kind: "external" }>,
  direction: "undo" | "redo",
): Promise<boolean> {
  const payload = operation.payload as Record<string, unknown>;
  if (operation.type === "source.availability") {
    const sourcePath = payload.sourcePath;
    if (typeof sourcePath !== "string") return false;
    const desired = (direction === "undo" ? payload.before : payload.after) as
      "available" | "deleted";

    const state = getState();
    const instanceIds =
      selectInstanceIdsBySourceKey(state).get(normalizeSourceKey(sourcePath)) ?? [];

    const expected = (direction === "undo" ? payload.after : payload.before) as
      "available" | "deleted";

    if (
      instanceIds.some((id) => state.editingInstances.entities[id]?.sourceAvailability !== expected)
    )
      return false;

    if (
      desired === "deleted" &&
      (hasActiveExportForSource(sourcePath, getState) ||
        instanceIds.some((id) => selectHasQueuedOrRenderingExportByInstanceId(state, id)))
    )
      return false;
    let fileChanged = false;
    try {
      if (desired === "deleted") await moveSourceToTrash(sourcePath);
      else await restoreSourceFromTrash(sourcePath);
      fileChanged = true;
      dispatch(editingInstancesSourceAvailabilityChanged({ availability: desired, sourcePath }));
      return true;
    } catch (error) {
      if (!fileChanged) return false;
      const compensationErrors: unknown[] = [];
      try {
        if (desired === "deleted") await restoreSourceFromTrash(sourcePath);
        else await moveSourceToTrash(sourcePath);
      } catch (compensationError) {
        compensationErrors.push(compensationError);
      }
      try {
        dispatch(editingInstancesSourceAvailabilityChanged({ availability: expected, sourcePath }));
      } catch (compensationError) {
        compensationErrors.push(compensationError);
      }
      if (compensationErrors.length)
        throw new AggregateError(
          [error, ...compensationErrors],
          "Source availability replay failed and rollback was incomplete",
          { cause: error },
        );
      throw error;
    }
  }
  if (operation.type === "instances.lifecycle") {
    const before = payload.before as Array<{ index: number; instance: EditingInstance }>;
    const after = payload.after as Array<{ index: number; instance: EditingInstance }>;
    const desired = direction === "undo" ? before : after;
    const currentIds = new Set([...before, ...after].map(({ instance }) => instance.id));
    const desiredIds = new Set(desired.map(({ instance }) => instance.id));
    const removing = [...currentIds].filter(
      (id) => !desiredIds.has(id) && getState().editingInstances.entities[id],
    );

    for (const id of removing) {
      const instance = getState().editingInstances.entities[id];
      if (
        selectHasQueuedOrRenderingExportByInstanceId(getState(), id) ||
        (instance && hasActiveExportForSource(instance.snapshot.source.sourcePath, getState))
      )
        return false;
    }
    const previous = [...before, ...after].flatMap(({ instance }) => {
      const index = getState().editingInstances.ids.indexOf(instance.id);
      const current = getState().editingInstances.entities[instance.id];
      return index >= 0 && current ? [{ index, instance: structuredClone(current) }] : [];
    });

    const previousActiveId = selectActiveInstanceId(getState());
    const activeId = (direction === "undo" ? payload.beforeActiveId : payload.afterActiveId) as
      string | null;

    try {
      dispatch(editingInstancesLifecycleChanged({ instances: desired, removeIds: removing }));
      if (activeId !== selectActiveInstanceId(getState())) {
        if (activeId && !getState().editingInstances.entities[activeId])
          throw new HistoryReplayRejected();
        if (!(await dispatch(navigateToEditingInstance(activeId))))
          throw new HistoryReplayRejected();
      }
      return true;
    } catch (error) {
      const compensationErrors: unknown[] = [];
      try {
        dispatch(
          editingInstancesLifecycleChanged({
            instances: previous,
            removeIds: [...currentIds].filter(
              (id) => !previous.some((item) => item.instance.id === id),
            ),
          }),
        );
      } catch (compensationError) {
        compensationErrors.push(compensationError);
      }
      if (previousActiveId !== selectActiveInstanceId(getState())) {
        try {
          if (!(await dispatch(navigateToEditingInstance(previousActiveId))))
            throw new Error("Active Editing Instance compensation was rejected");
        } catch (compensationError) {
          compensationErrors.push(compensationError);
        }
      }
      if (compensationErrors.length)
        throw new AggregateError(
          [error, ...compensationErrors],
          "Editing Instance lifecycle replay failed and rollback was incomplete",
          { cause: error },
        );
      if (error instanceof HistoryReplayRejected) return false;
      throw error;
    }
  }
  return false;
}
function undoWorkspaceHistory() {
  return (dispatch: Dispatch, getState: () => RootState) => {
    const state = getState();
    const data = selectWorkspaceHistory(state);
    for (let index = data.position - 1; index >= 0; index -= 1) {
      const operation = data.operations[index]!;
      if (
        (operation.kind === "state" && operation.role === "edit") ||
        operation.kind === "external"
      )
        return dispatch(applyHistoryPosition(index, false));
    }
    return Promise.resolve(false);
  };
}
function redoWorkspaceHistory() {
  return (dispatch: Dispatch, getState: () => RootState) => {
    const state = getState();
    const data = selectWorkspaceHistory(state);
    for (let index = data.position; index < data.operations.length; index += 1) {
      const operation = data.operations[index]!;
      if (
        (operation.kind === "state" && operation.role === "edit") ||
        operation.kind === "external"
      )
        return dispatch(applyHistoryPosition(index + 1, false));
    }
    return Promise.resolve(false);
  };
}
export { applyHistoryPosition, redoWorkspaceHistory, undoWorkspaceHistory };
