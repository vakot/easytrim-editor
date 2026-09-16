import { beforeEach, describe, expect, it, vi } from "vitest";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceReady } from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  enqueueExport,
  setExportQueueExecutionEnabled,
} from "@/app/store/integration/export-queue-runtime";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportCompleted,
  editingInstanceExportStarted,
  editingInstancesAdded,
  selectExportQueue,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { preferenceChanged } from "@/app/store/slices/preferences-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { createExportAttempt } from "@/domain/editing-instance";
import { firstSource, media } from "@/test/source.fixtures";

import { startFastCutRequested } from "../export-thunks";
import { restoreExportAttemptRequested } from "../source-media-thunks";

const native = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
  prepareSourcePreview: vi.fn(),
  chooseOutputPath: vi.fn(),
  reserveExportSource: vi.fn(),
  releaseExportSource: vi.fn(),
  renderFast: vi.fn(),
  moveSourceToTrash: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri/media")>()),
  ...native,
}));

beforeEach(() => {
  vi.clearAllMocks();
  native.activateSourcePath.mockResolvedValue(firstSource);
  native.prepareSourcePreview.mockResolvedValue({
    kind: "source",
    url: "media://source",
    mediaToken: 1,
  });
  native.chooseOutputPath.mockResolvedValue({
    displayName: "out.mp4",
    displayPath: "C:/out.mp4",
    outputId: "out",
  });
  native.reserveExportSource.mockResolvedValue(undefined);
  native.releaseExportSource.mockResolvedValue(undefined);
  native.renderFast.mockResolvedValue({
    displayName: "out.mp4",
    displayPath: "C:/out.mp4",
    operationId: "op",
  });
});

function setup() {
  const store = createAppStore();
  store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
  const snapshot = createDefaultEditorSnapshot(firstSource, false);
  snapshot.trim = { startMicros: 100_000, endMicros: 2_000_000 };
  store.dispatch(
    editingInstancesAdded([
      {
        id: "original",
        origin: "source-import",
        snapshot,
        media: media(firstSource.sourcePath),
        sourceAvailability: "available",
        exportAttempts: [],
      },
    ]),
  );
  store.dispatch(
    editingInstanceActivated({
      id: "original",
      snapshot,
      media: media(firstSource.sourcePath),
      loadToken: 1,
    }),
  );
  store.dispatch(sourceReady({ media: media(firstSource.sourcePath), loadToken: 1, snapshot }));
  return { store, snapshot };
}

describe("export snapshot restoration", () => {
  it("queues successive edits of the retained draft without changing earlier snapshots", async () => {
    const { snapshot, store } = setup();
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState()).pending).toHaveLength(1));
    const first = selectExportQueue(store.getState()).pending[0]!;
    expect(store.getState().editingInstances.activeInstanceId).toBe("original");
    expect(store.getState().source.status).toBe("ready");
    expect(store.getState().trim.value).toMatchObject(snapshot.trim);

    store.dispatch(
      trimChanged({
        trim: { startMicros: 500_000, endMicros: 3_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState()).pending).toHaveLength(2));
    const queue = selectExportQueue(store.getState()).pending;
    expect(queue[0]?.attempt.id).toBe(first.attempt.id);
    expect(queue[0]?.attempt.snapshot.trim).toEqual(snapshot.trim);
    expect(queue[0]?.attempt.request.trim).toEqual(snapshot.trim);
    expect(queue[1]?.attempt.snapshot.trim).toEqual({ startMicros: 500_000, endMicros: 3_000_000 });
    expect(queue[1]?.attempt.id).not.toBe(first.attempt.id);
    expect(selectImportedEditingInstances(store.getState()).map(({ id }) => id)).toEqual([
      "original",
    ]);
    expect(store.getState().editingInstances.activeInstanceId).toBe("original");
    expect(native.reserveExportSource).toHaveBeenCalledTimes(2);
  });

  it("restores captured optimized resolution, frame rate and custom arguments", async () => {
    const { snapshot, store } = setup();
    const resolution = { width: 1280, height: 720 };
    const frameRate = { numerator: 24, denominator: 1 };
    const attempt = createExportAttempt({
      capturedAt: 1,
      id: "optimized",
      output: { displayName: "out", displayPath: "out", outputId: "out" },
      route: "optimized",
      snapshot,
      request: {
        sourcePath: firstSource.sourcePath,
        trim: { startMicros: 100_000, endMicros: 2_000_000 },
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
        resolution,
        frameRate,
        arguments: "-c:v libx264 -crf 20",
      },
    });

    store.dispatch(editingInstanceExportAttemptQueued({ id: "original", attempt }));
    expect(
      await store.dispatch(
        restoreExportAttemptRequested({ instanceId: "original", attemptId: "optimized" }),
      ),
    ).toBe(true);
    expect(
      selectImportedEditingInstances(store.getState()).find(({ id }) => id !== "original")
        ?.optimizedSettings,
    ).toEqual({
      resolution,
      frameRate,
    });
    expect(store.getState().exportPresets.argumentsText).toBe("-c:v libx264 -crf 20");
  });

  it("auto-starts an export while keeping its editable draft active in Imported Sources", async () => {
    const { store } = setup();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: true }));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() =>
      expect(
        store.getState().editingInstances.entities.original?.exportAttempts[0]?.state.status,
      ).toBe("completed"),
    );
    expect(selectImportedEditingInstances(store.getState()).map(({ id }) => id)).toContain(
      "original",
    );
    expect(store.getState().editingInstances.activeInstanceId).toBe("original");
  });

  it("marks retained same-file drafts deleted after the last export with automatic deletion enabled", async () => {
    const { snapshot, store } = setup();
    store.dispatch(
      editingInstancesAdded([
        {
          id: "other",
          origin: "source-import",
          snapshot,
          sourceAvailability: "available",
          exportAttempts: [],
        },
      ]),
    );
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: true }));
    store.dispatch(preferenceChanged({ key: "deleteSourceOnRenderFinish", enabled: true }));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() =>
      expect(
        store.getState().editingInstances.entities.original?.exportAttempts[0]?.state.status,
      ).toBe("completed"),
    );
    expect(native.moveSourceToTrash).toHaveBeenCalledExactlyOnceWith(firstSource.sourcePath);
    expect(store.getState().editingInstances.entities.original?.sourceAvailability).toBe("deleted");
    expect(store.getState().editingInstances.entities.other?.sourceAvailability).toBe("deleted");
    expect(selectImportedEditingInstances(store.getState()).map(({ id }) => id)).toEqual([
      "original",
      "other",
    ]);
  });

  it("queues a draft, restores a separate draft by ID, and requeues the edited snapshot", async () => {
    const { snapshot, store } = setup();
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState()).pending).toHaveLength(1));
    expect(selectImportedEditingInstances(store.getState()).map(({ id }) => id)).toContain(
      "original",
    );
    expect(store.getState().editingInstances.activeInstanceId).toBe("original");
    const first = selectExportQueue(store.getState()).pending[0]!;
    await store.dispatch(
      restoreExportAttemptRequested({ instanceId: "original", attemptId: first.attempt.id }),
    );
    const restored = selectImportedEditingInstances(store.getState()).find(
      ({ id }) => id !== "original",
    )!;

    expect(restored.id).not.toBe("original");
    expect(restored.snapshot.trim).toEqual(snapshot.trim);
    expect(selectExportQueue(store.getState()).pending).toEqual([]);
    expect(native.releaseExportSource).toHaveBeenCalledOnce();
    store.dispatch(
      trimChanged({
        trim: { startMicros: 500_000, endMicros: 3_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState()).pending).toHaveLength(1));
    const next = selectExportQueue(store.getState()).pending[0]!;
    expect(next.attempt.id).not.toBe(first.attempt.id);
    expect(next.attempt.request.trim).toEqual({ startMicros: 500_000, endMicros: 3_000_000 });
    setExportQueueExecutionEnabled(true, store.dispatch, store.getState);
    await vi.waitFor(() =>
      expect(
        store.getState().editingInstances.entities[restored.id]?.exportAttempts[0]?.state.status,
      ).toBe("completed"),
    );
    expect(native.renderFast).toHaveBeenCalledOnce();
    expect(selectImportedEditingInstances(store.getState()).map(({ id }) => id)).toContain(
      "original",
    );
  });

  it("keeps existing same-file drafts when restoring history and preserves the historical attempt", async () => {
    const { snapshot, store } = setup();
    const attempt = createExportAttempt({
      capturedAt: 1,
      id: "history",
      output: { displayName: "out", displayPath: "out", outputId: "out" },
      request: {
        sourcePath: firstSource.sourcePath,
        trim: { startMicros: 100_000, endMicros: 2_000_000 },
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
      },
      route: "fast",
      snapshot,
    });

    store.dispatch(editingInstanceExportAttemptQueued({ id: "original", attempt }));
    store.dispatch(
      editingInstanceExportStarted({ id: "original", attemptId: "history", startedAt: 2 }),
    );
    expect(
      await store.dispatch(
        restoreExportAttemptRequested({ instanceId: "original", attemptId: "history" }),
      ),
    ).toBe(false);
    store.dispatch(
      editingInstanceExportCompleted({
        id: "original",
        attemptId: "history",
        durationMs: 1,
        result: { displayName: "out", displayPath: "out", operationId: "op" },
      }),
    );
    await store.dispatch(
      restoreExportAttemptRequested({ instanceId: "original", attemptId: "history" }),
    );
    const firstId = store.getState().editingInstances.activeInstanceId;
    await store.dispatch(
      restoreExportAttemptRequested({ instanceId: "original", attemptId: "history" }),
    );
    expect(store.getState().editingInstances.activeInstanceId).not.toBe(firstId);
    expect(selectImportedEditingInstances(store.getState())).toHaveLength(3);
    expect(
      store.getState().editingInstances.entities.original?.exportAttempts[0]?.state.status,
    ).toBe("completed");
  });

  it("removes a pending job before asynchronous restoration and retains the draft on activation failure", async () => {
    const { snapshot, store } = setup();
    const attempt = createExportAttempt({
      capturedAt: 1,
      id: "pending",
      output: { displayName: "out", displayPath: "out", outputId: "out" },
      request: {
        sourcePath: firstSource.sourcePath,
        trim: { startMicros: 0, endMicros: 1_000_000 },
        audioTracks: [],
        mergeAudio: false,
        rotationDegrees: 0,
      },
      route: "fast",
      snapshot,
    });

    store.dispatch(editingInstanceExportAttemptQueued({ id: "original", attempt }));
    enqueueExport("original", attempt, store.dispatch, store.getState);
    native.activateSourcePath.mockRejectedValueOnce(new Error("missing file"));
    const restoration = store.dispatch(
      restoreExportAttemptRequested({ instanceId: "original", attemptId: "pending" }),
    );

    setExportQueueExecutionEnabled(true, store.dispatch, store.getState);
    expect(await restoration).toBe(false);
    expect(native.renderFast).not.toHaveBeenCalled();
    expect(selectImportedEditingInstances(store.getState())).toHaveLength(2);
    expect(selectExportQueue(store.getState()).pending).toEqual([]);
  });
});
