import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import { createEditorSnapshot } from "@/domain/editor-snapshot";
import { firstSource, secondSource } from "@/test/source.fixtures";

import {
  activeEditingInstanceChanged,
  editingInstanceClosed,
  editingInstanceDuplicated,
  editingInstanceExportAttemptQueued,
  editingInstanceExportCompleted,
  editingInstanceExportFailed,
  editingInstanceExportHistoryCleared,
  editingInstanceExportProgressReceived,
  editingInstanceExportStarted,
  editingInstancesAdded,
  editingInstancesClosed,
  editingInstanceSnapshotUpdated,
  editingInstancesReducer,
  editingInstancesSourceAvailabilityChanged,
  initialEditingInstancesState,
  selectActiveEditingInstance,
  selectEditingInstanceAttempts,
  selectEditingInstanceIds,
  selectEditingInstanceStatusById,
  selectEditingInstanceTopologyEntries,
  selectHasQueuedOrRenderingExportByInstanceId,
  selectProcessableExportCount,
} from "../editing-instances-slice";

const baseSnapshot = createDefaultEditorSnapshot(firstSource, false);

function instance(id: string, snapshot = baseSnapshot): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot,
    sourceAvailability: "available",
  };
}

function attempt(id: string, snapshot = baseSnapshot) {
  return createExportAttempt({
    capturedAt: 10,
    id,
    output: {
      displayName: `${id}.mp4`,
      displayPath: `C:/Exports/${id}.mp4`,
      outputId: `output-${id}`,
    },
    request: {
      audioTracks: [],
      mergeAudio: false,
      sourcePath: snapshot.source.sourcePath,
      trim: { endMicros: 1_000_000, startMicros: 0 },
    },
    route: "fast",
    snapshot,
  });
}

describe("editing instances slice", () => {
  it("keeps imported and duplicated instances as stable independent identities", () => {
    const first = instance("instance-1");
    const duplicate = instance("instance-2", {
      ...baseSnapshot,
      trim: { endMicros: 2_000_000, startMicros: 500_000 },
    });

    const state = editingInstancesReducer(
      initialEditingInstancesState,
      editingInstancesAdded([first, duplicate]),
    );

    expect(state.ids).toEqual(["instance-1", "instance-2"]);
    expect(state.entities["instance-1"]?.snapshot.trim).toEqual({ kind: "full-source" });
    expect(state.entities["instance-2"]?.snapshot.trim).toEqual({
      endMicros: 2_000_000,
      startMicros: 500_000,
    });

    const explicitDuplicate = { ...duplicate, id: "instance-3", origin: "duplicate" as const };
    const duplicatedState = editingInstancesReducer(
      state,
      editingInstanceDuplicated(explicitDuplicate),
    );

    expect(duplicatedState.entities["instance-3"]?.origin).toBe("duplicate");
    expect(duplicatedState.entities["instance-3"]?.id).toBe("instance-3");
  });

  it("captures an attempt snapshot and ignores stale terminal callbacks", () => {
    const queuedAttempt = attempt("attempt-1");
    let state = editingInstancesReducer(
      initialEditingInstancesState,
      editingInstancesAdded([instance("instance-1")]),
    );

    state = editingInstancesReducer(state, activeEditingInstanceChanged("instance-1"));
    state = editingInstancesReducer(
      state,
      editingInstanceExportAttemptQueued({ id: "instance-1", attempt: queuedAttempt }),
    );
    state = editingInstancesReducer(
      state,
      editingInstanceExportStarted({ attemptId: "attempt-1", id: "instance-1", startedAt: 20 }),
    );
    state = editingInstancesReducer(
      state,
      editingInstanceExportProgressReceived({
        attemptId: "attempt-1",
        id: "instance-1",
        metrics: { currentFrame: 4, progressPercent: 40 },
        progress: {
          elapsedMicros: 400_000,
          frame: 4,
          operationId: "operation-1",
          phase: "running",
          speed: "1x",
          totalSize: 42,
        },
      }),
    );
    state = editingInstancesReducer(
      state,
      editingInstanceExportProgressReceived({
        attemptId: "attempt-1",
        id: "instance-1",
        metrics: { currentFrame: 99, progressPercent: 99 },
        progress: {
          elapsedMicros: 999_000,
          frame: 99,
          operationId: "stale-operation",
          phase: "running",
        },
      }),
    );
    expect(state.entities["instance-1"]?.exportAttempts[0]?.metrics.currentFrame).toBe(4);

    const editedSnapshot = createEditorSnapshot({
      audioTracks: baseSnapshot.audio.tracks,
      crop: baseSnapshot.crop,
      masterAudio: baseSnapshot.audio.master,
      mergeAudio: baseSnapshot.audio.mergeAudio,
      source: baseSnapshot.source,
      trim: { endMicros: 3_000_000, startMicros: 1_000_000 },
    });

    state = editingInstancesReducer(
      state,
      editingInstanceSnapshotUpdated({ id: "instance-1", snapshot: editedSnapshot }),
    );
    state = editingInstancesReducer(
      state,
      editingInstanceExportCompleted({
        attemptId: "attempt-1",
        durationMs: 100,
        id: "instance-1",
        result: {
          displayName: "attempt-1.mp4",
          displayPath: "C:/Exports/attempt-1.mp4",
          operationId: "operation-1",
        },
      }),
    );
    state = editingInstancesReducer(
      state,
      editingInstanceExportFailed({
        attemptId: "attempt-1",
        durationMs: 200,
        error: { code: "stale", message: "Should be ignored" },
        id: "instance-1",
      }),
    );

    const saved = state.entities["instance-1"]!;
    expect(saved.snapshot.trim).toEqual({ endMicros: 3_000_000, startMicros: 1_000_000 });
    expect(saved.exportAttempts[0]?.snapshot.trim).toEqual({ kind: "full-source" });
    expect(saved.exportAttempts[0]?.state.status).toBe("completed");
  });

  it("clears only terminal history and keeps the editing instance", () => {
    const queued = attempt("queued");
    let state = editingInstancesReducer(
      initialEditingInstancesState,
      editingInstancesAdded([instance("instance-1")]),
    );

    state = editingInstancesReducer(
      state,
      editingInstanceExportAttemptQueued({ id: "instance-1", attempt: queued }),
    );
    state = editingInstancesReducer(state, editingInstanceExportHistoryCleared());
    expect(state.ids).toEqual(["instance-1"]);
    expect(state.entities["instance-1"]?.exportAttempts).toHaveLength(1);

    state = editingInstancesReducer(
      state,
      editingInstanceExportStarted({ attemptId: "queued", id: "instance-1", startedAt: 20 }),
    );
    state = editingInstancesReducer(
      state,
      editingInstanceExportCompleted({
        attemptId: "queued",
        durationMs: 100,
        id: "instance-1",
        result: {
          displayName: "completed.mp4",
          displayPath: "C:/Exports/completed.mp4",
          operationId: "operation-2",
        },
      }),
    );
    state = editingInstancesReducer(state, editingInstanceExportHistoryCleared("instance-1"));

    expect(state.ids).toEqual(["instance-1"]);
    expect(state.entities["instance-1"]?.exportAttempts).toEqual([]);
  });

  it("propagates source availability across instances sharing one source path", () => {
    const sameSource = instance("instance-2", {
      ...baseSnapshot,
      source: { ...firstSource, displayName: "copy.mp4", sourcePath: "C:\\Media\\first.mp4" },
    });

    let state = editingInstancesReducer(
      initialEditingInstancesState,
      editingInstancesAdded([
        instance("instance-1"),
        sameSource,
        instance("instance-3", { ...baseSnapshot, source: secondSource }),
      ]),
    );

    state = editingInstancesReducer(
      state,
      editingInstancesSourceAvailabilityChanged({
        availability: "deleted",
        sourcePath: firstSource.sourcePath,
      }),
    );

    expect(state.entities["instance-1"]?.sourceAvailability).toBe("deleted");
    expect(state.entities["instance-2"]?.sourceAvailability).toBe("deleted");
    expect(state.entities["instance-3"]?.sourceAvailability).toBe("available");
  });

  it("closes one instance without deleting another instance or its history", () => {
    const first = instance("instance-1");
    first.exportAttempts.push(attempt("attempt-1"));
    let state = editingInstancesReducer(
      initialEditingInstancesState,
      editingInstancesAdded([first, instance("instance-2")]),
    );

    state = editingInstancesReducer(state, activeEditingInstanceChanged("instance-1"));
    state = editingInstancesReducer(state, editingInstanceClosed("instance-1"));

    expect(selectActiveEditingInstance({ editingInstances: state } as never)).toBeUndefined();
    expect(selectEditingInstanceAttempts({ editingInstances: state } as never)).toHaveLength(0);
    expect(state.entities["instance-2"]?.snapshot.source).toEqual(firstSource);
  });

  it("closes a batch in one state transition while preserving surviving instances", () => {
    const first = instance("instance-1");
    const second = instance("instance-2", { ...baseSnapshot, source: secondSource });
    const third = instance("instance-3");
    let state = editingInstancesReducer(
      initialEditingInstancesState,
      editingInstancesAdded([first, second, third]),
    );

    state = editingInstancesReducer(state, activeEditingInstanceChanged("instance-2"));
    state = editingInstancesReducer(state, editingInstancesClosed(["instance-1", "instance-2"]));

    expect(state.ids).toEqual(["instance-3"]);
    expect(state.entities["instance-1"]).toBeUndefined();
    expect(state.entities["instance-2"]).toBeUndefined();
    expect(state.entities["instance-3"]?.snapshot.source).toEqual(firstSource);
    expect(state.activeInstanceId).toBeNull();
  });

  it("keeps narrow read models stable across unrelated progress updates", () => {
    const first = instance("instance-1");
    const second = instance("instance-2", { ...baseSnapshot, source: secondSource });
    let state = editingInstancesReducer(
      initialEditingInstancesState,
      editingInstancesAdded([first, second]),
    );

    const root = () => ({ editingInstances: state }) as never;
    const ids = selectEditingInstanceIds(root());
    const topology = selectEditingInstanceTopologyEntries(root());

    const queuedAttempt = attempt("attempt-1");
    state = editingInstancesReducer(
      state,
      editingInstanceExportAttemptQueued({ id: "instance-1", attempt: queuedAttempt }),
    );
    state = editingInstancesReducer(
      state,
      editingInstanceExportStarted({ attemptId: "attempt-1", id: "instance-1", startedAt: 20 }),
    );
    state = editingInstancesReducer(
      state,
      editingInstanceExportProgressReceived({
        attemptId: "attempt-1",
        id: "instance-1",
        metrics: { progressPercent: 10 },
        progress: {
          elapsedMicros: 100_000,
          operationId: "operation-1",
          phase: "running",
        },
      }),
    );

    expect(selectEditingInstanceIds(root())).toBe(ids);
    expect(selectEditingInstanceTopologyEntries(root())).toBe(topology);
    expect(selectEditingInstanceStatusById(root(), "instance-1")).toBe("rendering");
    expect(selectHasQueuedOrRenderingExportByInstanceId(root(), "instance-1")).toBe(true);
    expect(selectProcessableExportCount(root())).toBe(1);
  });
});
