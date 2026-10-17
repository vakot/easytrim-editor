import {
  createEditorSnapshotFromState,
  historyProjection,
} from "@/app/store/integration/editor-snapshot";
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
  editingInstanceSnapshotUpdated,
  selectActiveInstanceId,
} from "@/app/store/slices/editing-instances-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import {
  historyReplayFinished,
  historyReplayStarted,
  selectWorkspaceHistory,
} from "@/app/store/slices/workspace-history-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import type { AudioTrackSettings } from "@/domain/audio-processing";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import { normalizeSourceKey } from "@/domain/source";
import { createFullTrimRange } from "@/domain/trim";
import type { HistoryChange, HistorySlot, HistoryTarget } from "@/domain/workspace-history";

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
function applyHistoryPosition(position: number) {
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
      operation.kind === "state" ? [{ operation, direction }] : [],
    );

    if (ordered.some((operation) => operation.kind === "external")) return false;

    const simulated = new Map<string, EditorSnapshot>();
    for (const { direction: stepDirection, operation } of steps) {
      for (const change of operation.changes) {
        if (change.target.kind !== "instance") return false;
        const instance = getState().editingInstances.entities[change.target.instanceId];
        const current =
          simulated.get(change.target.instanceId) ??
          currentSnapshot(getState(), change.target.instanceId) ??
          instance?.snapshot;

        if (
          !instance ||
          normalizeSourceKey(instance.snapshot.source.sourcePath) !==
            normalizeSourceKey(change.target.sourceId) ||
          !current ||
          normalizeSourceKey(current.source.sourcePath) !==
            normalizeSourceKey(change.target.sourceId)
        )
          return false;
        const projection = editorProjection(current) as Record<string, unknown>;
        const expected = valueOf(stepDirection === "undo" ? change.after : change.before);
        if (!equal(projection[change.field], expected)) return false;
        simulated.set(change.target.instanceId, applyChange(current, change, stepDirection));
      }
    }
    dispatch(historyReplayStarted());
    try {
      for (const { direction: stepDirection, operation } of steps) {
        if (operation.kind !== "state") continue;
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

          if (!snapshot) continue;
          const next = applyChange(snapshot, change, stepDirection);
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
      }
      dispatch(historyReplayFinished({ position }));
      return true;
    } catch (error) {
      dispatch(historyReplayFinished({ position: history.position }));
      throw error;
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
        return dispatch(applyHistoryPosition(index));
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
        return dispatch(applyHistoryPosition(index + 1));
    }
    return Promise.resolve(false);
  };
}
export { applyHistoryPosition, redoWorkspaceHistory, undoWorkspaceHistory };
