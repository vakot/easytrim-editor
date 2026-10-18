import { sourceCleared } from "@/app/store/actions/source-actions";
import { workspaceHistoryTransitionCommitted } from "@/app/store/actions/workspace-history-actions";
import { historyProjection } from "@/app/store/integration/editor-snapshot";
import { hasActiveExportForSource } from "@/app/store/integration/export-queue-runtime";
import {
  audioTrackDefaultChanged,
  audioTrackFiltersApplied,
  audioTrackMetadataChanged,
  audioTrackSyncOffsetChanged,
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
  activeEditingInstanceChanged,
  editingInstanceGifSettingsChanged,
  editingInstanceOptimizedSettingsChanged,
  editingInstancesLifecycleChanged,
  editingInstanceSnapshotUpdated,
  editingInstancesSourceAvailabilityChanged,
  selectActiveInstanceId,
  selectHasQueuedOrRenderingExportByInstanceId,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import {
  historyReplayFinished,
  historyReplayStarted,
  selectWorkspaceHistory,
} from "@/app/store/slices/workspace-history-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import {
  activateEditingInstanceRequested,
  resumeSourceThumbnailPreparation,
} from "@/app/store/thunks/source-media-thunks";
import { type AudioTrackSettings, serializeAudioTrackSettings } from "@/domain/audio-processing";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import { normalizeSourceKey } from "@/domain/source";
import { createFullTrimRange } from "@/domain/trim";
import type { HistoryTarget } from "@/domain/workspace-history";
import { moveSourceToTrash, restoreSourceFromTrash } from "@/lib/tauri/media";

import {
  currentHistorySnapshot,
  type HistoryActivationTarget,
  type HistoryDestination,
  historyValuesEqual,
  resolveHistoryDestination,
  type SourceEffect,
} from "./workspace-history-resolution";
import { createHistoryStage } from "./workspace-history-stage";

type Dispatch = AppDispatch;
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
    if (!historyValuesEqual(track.processing.syncOffset, desired.processing.syncOffset))
      dispatch(
        audioTrackSyncOffsetChanged({
          streamIndex,
          syncOffset: desired.processing.syncOffset ?? null,
        }),
      );
    if (track.processing.volume !== desired.processing.volume)
      dispatch(audioTrackVolumeChanged({ streamIndex, volume: desired.processing.volume }));
    if (!historyValuesEqual(track.processing.filters, desired.processing.filters))
      dispatch(audioTrackFiltersApplied({ streamIndex, filters: desired.processing.filters }));
  } else if (field.startsWith("chapter:")) {
    const chapterId = field.slice("chapter:".length);
    const existing = selectChapters(state).find((chapter) => chapter.id === chapterId);
    const desired = snapshot.chapters?.find((chapter) => chapter.id === chapterId);
    if (existing && !desired) dispatch(chapterDeleted(chapterId));
    else if (desired && !existing) dispatch(chapterAdded(desired));
    else if (existing && desired && !historyValuesEqual(existing, desired))
      dispatch(chapterUpdated(desired));
  } else if (field === "chapters") {
    const current = selectChapters(state);
    for (const chapter of current)
      if (!snapshot.chapters?.some((next) => next.id === chapter.id))
        dispatch(chapterDeleted(chapter.id));
    for (const chapter of snapshot.chapters ?? []) {
      const existing = current.find((item) => item.id === chapter.id);
      if (!existing) dispatch(chapterAdded(chapter));
      else if (!historyValuesEqual(existing, chapter)) dispatch(chapterUpdated(chapter));
    }
  }
}

class HistoryReplayRejected extends Error {
  constructor() {
    super("Workspace history transition was rejected");
    this.name = "HistoryReplayRejected";
  }
}

function reconcileActiveAudioTracks(
  dispatch: Dispatch,
  getState: () => RootState,
  id: string,
  snapshot: EditorSnapshot,
) {
  if (selectActiveInstanceId(getState()) !== id) return;
  // Selection reducers normalize defaults across tracks. Restore the saved default only after
  // every track's enabled state has been restored, including tracks whose default was cleared.
  const desiredDefault = snapshot.audio.tracks.find(
    (track) => track.enabled && track.metadata.isDefault,
  );

  if (
    desiredDefault &&
    getState().audio.tracks.some(
      (track) => track.metadata.isDefault !== (track.streamIndex === desiredDefault.streamIndex),
    )
  )
    dispatch(audioTrackDefaultChanged({ streamIndex: desiredDefault.streamIndex }));
  const settings = (tracks: AudioTrackSettings[]) =>
    tracks.map(serializeAudioTrackSettings).sort((a, b) => a.streamIndex - b.streamIndex);

  if (!historyValuesEqual(settings(getState().audio.tracks), settings(snapshot.audio.tracks)))
    throw new HistoryReplayRejected();
}

function workspaceSignature(state: RootState): string {
  return JSON.stringify({
    active: state.editingInstances.activeInstanceId,
    loadToken: state.source.loadToken,
    argumentsText: state.exportPresets.argumentsText,
    instances: state.editingInstances.ids.map((id) => {
      const instance = state.editingInstances.entities[id]!;
      return {
        id,
        snapshot: currentHistorySnapshot(state, id),
        sourceAvailability: instance.sourceAvailability,
        draftAvailable: instance.draftAvailable,
        optimizedArguments: instance.optimizedArguments,
        optimizedSettings: instance.optimizedSettings,
        gifSettings: instance.gifSettings,
      };
    }),
  });
}

function destinationIsSafe(state: RootState, destination: HistoryDestination): boolean {
  const retained = new Set(destination.instances.map(({ id }) => id));
  for (const id of state.editingInstances.ids) {
    const instance = state.editingInstances.entities[id]!;
    if (
      !retained.has(id) &&
      (selectHasQueuedOrRenderingExportByInstanceId(state, id) ||
        hasActiveExportForSource(instance.snapshot.source.sourcePath, () => state))
    )
      return false;
  }
  for (const effect of destination.files) {
    if (effect.after !== "deleted") continue;
    if (!sourceCanBeDeleted(state, effect.sourcePath)) return false;
  }
  return true;
}

function sourceCanBeDeleted(state: RootState, sourcePath: string): boolean {
  return (
    !hasActiveExportForSource(sourcePath, () => state) &&
    !state.editingInstances.ids.some((id) => {
      const instance = state.editingInstances.entities[id]!;
      return (
        normalizeSourceKey(instance.snapshot.source.sourcePath) ===
          normalizeSourceKey(sourcePath) && selectHasQueuedOrRenderingExportByInstanceId(state, id)
      );
    })
  );
}

async function changeSourceFile(
  effect: SourceEffect,
  getState: () => RootState,
  reverse = false,
): Promise<void> {
  const desired = reverse ? effect.before : effect.after;
  if (desired === "deleted") {
    if (!sourceCanBeDeleted(getState(), effect.sourcePath)) throw new HistoryReplayRejected();
    await moveSourceToTrash(effect.sourcePath);
  } else await restoreSourceFromTrash(effect.sourcePath);
}

async function prepareDestination(
  state: RootState,
  destination: HistoryDestination,
  position: number,
) {
  const stage = createHistoryStage(state);
  const removing = state.editingInstances.ids.filter(
    (id) => !destination.instances.some((instance) => instance.id === id),
  );

  const changed = destination.instances.flatMap((instance, index) => {
    const previous = state.editingInstances.entities[instance.id];
    return !historyValuesEqual(previous, instance) ||
      state.editingInstances.ids[index] !== instance.id
      ? [{ index, instance }]
      : [];
  });

  const structureChanged =
    !historyValuesEqual(
      state.editingInstances.ids,
      destination.instances.map(({ id }) => id),
    ) || destination.lifecycleInstanceIds.some((id) => state.editingInstances.entities[id]);

  if (structureChanged) {
    stage.dispatch(
      editingInstancesLifecycleChanged({
        instances: destination.instances.map((instance, index) => ({ index, instance })),
        removeIds: removing,
      }),
    );
  } else {
    for (const { instance } of changed) {
      const previous = state.editingInstances.entities[instance.id]!;
      if (
        !historyValuesEqual(previous.snapshot, instance.snapshot) ||
        previous.optimizedArguments !== instance.optimizedArguments
      )
        stage.dispatch(
          editingInstanceSnapshotUpdated({
            id: instance.id,
            snapshot: instance.snapshot,
            optimizedArguments: instance.optimizedArguments,
          }),
        );
    }
  }
  for (const effect of destination.files)
    stage.dispatch(
      editingInstancesSourceAvailabilityChanged({
        availability: effect.after,
        sourcePath: effect.sourcePath,
      }),
    );
  const id = destination.activeInstanceId;
  const active = id ? stage.getState().editingInstances.entities[id] : null;
  const sourceChanged =
    id !== state.editingInstances.activeInstanceId ||
    (!id && state.source.source !== null) ||
    (active &&
      (state.source.status !== "ready" ||
        normalizeSourceKey(state.source.source?.sourcePath ?? "") !==
          normalizeSourceKey(active.snapshot.source.sourcePath)));

  let analysisChanged = Boolean(sourceChanged);
  if (sourceChanged) {
    if (active) {
      if (
        active.sourceAvailability !== "available" ||
        !(await stage.dispatch(
          activateEditingInstanceRequested(active, { deferThumbnailQueue: true }),
        ))
      )
        throw new HistoryReplayRejected();
      if (stage.getState().preview.value.status !== "ready") throw new HistoryReplayRejected();
      const snapshot = currentHistorySnapshot(stage.getState(), active.id);
      if (snapshot) stage.dispatch(editingInstanceSnapshotUpdated({ id: active.id, snapshot }));
    } else {
      stage.dispatch(sourceCleared());
      stage.dispatch(activeEditingInstanceChanged(null));
    }
  } else if (active) {
    const previous = currentHistorySnapshot(state, active.id)!;
    const before = historyProjection(previous);
    const after = historyProjection(active.snapshot);
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
      (field) => !historyValuesEqual(before[field], after[field]),
    );

    // Rotation changes crop coordinates; restore the final crop after applying rotation once.
    if (fields.includes("rotation") && !fields.includes("crop")) fields.push("crop");
    fields.sort(
      (a, b) =>
        (a === "rotation" ? 0 : a === "crop" ? 1 : 2) -
        (b === "rotation" ? 0 : b === "crop" ? 1 : 2),
    );
    const target: HistoryTarget = {
      kind: "instance",
      instanceId: active.id,
      sourceId: active.snapshot.source.sourcePath,
    };

    for (const field of fields)
      restoreActiveField(stage.dispatch, stage.getState, field, active.snapshot, target);
    if (fields.some((field) => field.startsWith("audio:")))
      reconcileActiveAudioTracks(stage.dispatch, stage.getState, active.id, active.snapshot);
    analysisChanged =
      fields.includes("trim") ||
      !historyValuesEqual(
        previous.audio.tracks.map(({ enabled, processing }) => ({
          enabled,
          filters: processing.filters,
        })),
        active.snapshot.audio.tracks.map(({ enabled, processing }) => ({
          enabled,
          filters: processing.filters,
        })),
      );
  }
  for (const instance of destination.instances) {
    if (!destination.transformedInstanceIds.includes(instance.id)) continue;
    const previous = currentHistorySnapshot(state, instance.id);
    if (
      previous &&
      historyValuesEqual(previous.crop, instance.snapshot.crop) &&
      previous.rotation === instance.snapshot.rotation
    )
      continue;
    const final = stage.getState().editingInstances.entities[instance.id];
    if (!final?.media) continue;
    const resolution = cropResolutionFor(
      final.media.video ?? null,
      final.snapshot.crop ?? { x: 0, y: 0, width: 1, height: 1 },
      final.snapshot.rotation ?? 0,
    );

    stage.dispatch(
      editingInstanceOptimizedSettingsChanged({
        id: final.id,
        settings: { frameRate: final.optimizedSettings?.frameRate, resolution },
      }),
    );
    if (final.gifSettings)
      stage.dispatch(
        editingInstanceGifSettingsChanged({
          id: final.id,
          settings: { ...final.gifSettings, resolution },
        }),
      );
  }
  stage.dispatch(historyReplayFinished({ position }));
  return { actions: stage.actions, sourceChanged: Boolean(sourceChanged), analysisChanged };
}

function applyHistoryPosition(
  position: number,
  includeNavigation = true,
  activationTarget?: HistoryActivationTarget,
) {
  return async (dispatch: Dispatch, getState: () => RootState): Promise<boolean> => {
    const original = getState();
    const history = selectWorkspaceHistory(original);
    if (
      original.workspaceHistory.replaying ||
      original.workspaceHistory.interaction ||
      original.source.status === "loading-source" ||
      !Number.isInteger(position) ||
      position < 0 ||
      position > history.operations.length ||
      position === history.position
    )
      return false;
    const destination = resolveHistoryDestination(
      original,
      position,
      includeNavigation,
      activationTarget,
    );

    if (!destination || !destinationIsSafe(original, destination)) return false;
    const signature = workspaceSignature(original);
    const applied: SourceEffect[] = [];
    dispatch(historyReplayStarted());
    try {
      for (const effect of destination.files) {
        if (
          workspaceSignature(getState()) !== signature ||
          !destinationIsSafe(getState(), destination)
        )
          throw new HistoryReplayRejected();
        try {
          await changeSourceFile(effect, getState);
        } catch {
          throw new HistoryReplayRejected();
        }
        applied.push(effect);
      }
      if (workspaceSignature(getState()) !== signature) throw new HistoryReplayRejected();
      const commit = await prepareDestination(getState(), destination, position);
      if (
        workspaceSignature(getState()) !== signature ||
        !destinationIsSafe(getState(), destination)
      )
        throw new HistoryReplayRejected();
      dispatch(workspaceHistoryTransitionCommitted(commit));
      return true;
    } catch (error) {
      const compensationErrors: unknown[] = [];
      for (const effect of applied.reverse()) {
        try {
          await changeSourceFile(effect, getState, true);
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
    } finally {
      dispatch(resumeSourceThumbnailPreparation());
    }
  };
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
