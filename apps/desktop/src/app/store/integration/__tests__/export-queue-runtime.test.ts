import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelOperation: vi.fn().mockResolvedValue(undefined),
  moveSourceToTrash: vi.fn().mockResolvedValue(undefined),
  performQueueFinishAction: vi.fn().mockResolvedValue(undefined),
  releaseExportSource: vi.fn().mockResolvedValue(undefined),
  renderFast: vi.fn(),
  renderOptimized: vi.fn(),
  startOperation: vi.fn(),
}));

vi.mock("@/lib/tauri/media", () => ({
  cancelOperation: mocks.cancelOperation,
  moveSourceToTrash: mocks.moveSourceToTrash,
  releaseExportSource: mocks.releaseExportSource,
  renderFast: mocks.renderFast,
  renderOptimized: mocks.renderOptimized,
}));
vi.mock("@/lib/tauri/queue", () => ({
  performQueueFinishAction: mocks.performQueueFinishAction,
}));
vi.mock("@/lib/diagnostics", () => ({
  diagnostics: {
    action: vi.fn(),
    error: vi.fn(),
    event: vi.fn(),
    startOperation: mocks.startOperation.mockImplementation(() => ({
      cancel: vi.fn(),
      complete: vi.fn(),
      fail: vi.fn(),
      operationId: "diagnostic-operation",
    })),
  },
}));

import { createExportAttempt, type EditingInstance } from "@/domain/editing-instance";
import type { ExportProgress } from "@/lib/tauri/media.types";
import { firstSource, secondSource } from "@/test/source.fixtures";

import {
  editingInstanceExportAttemptQueued,
  editingInstancesAdded,
} from "../../slices/editing-instances-slice";
import { selectQueueStarted, selectSourceQueueStarted } from "../../slices/export-slice";
import { preferenceChanged } from "../../slices/preferences-slice";
import { createAppStore } from "../../store";
import {
  cancelAllExportsRequested,
  cancelSourceExportQueue,
  startSourceExportQueue,
} from "../../thunks/export-thunks";
import { createDefaultEditorSnapshot } from "../editor-snapshot";
import {
  cancelAndRequeueExport,
  cancelQueuedExport,
  enqueueExport,
  setExportQueueExecutionEnabled,
  withdrawPendingExport,
} from "../export-queue-runtime";

function createAttempt(id: string, sourcePath: string = firstSource.sourcePath) {
  const snapshot = createDefaultEditorSnapshot({ displayName: `${id}.mp4`, sourcePath }, false);
  return createExportAttempt({
    capturedAt: 1,
    id,
    output: { displayName: `${id}.mp4`, displayPath: `C:/Exports/${id}.mp4`, outputId: id },
    request: {
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0,
      sourcePath,
      trim: { endMicros: 1_000_000, startMicros: 0 },
    },
    route: "fast",
    snapshot,
  });
}

function createInstance(id: string, sourcePath: string = firstSource.sourcePath): EditingInstance {
  return {
    exportAttempts: [],
    id,
    origin: "source-import",
    snapshot: createDefaultEditorSnapshot({ displayName: `${id}.mp4`, sourcePath }, false),
    sourceAvailability: "available",
  };
}

function progress(operationId: string, frame: number): ExportProgress {
  return {
    elapsedMicros: frame * 100_000,
    frame,
    operationId,
    phase: "running",
    speed: "1x",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.releaseExportSource.mockResolvedValue(undefined);
  mocks.moveSourceToTrash.mockResolvedValue(undefined);
  mocks.startOperation.mockClear();
});

describe("export queue runtime", () => {
  it("starts only the requested instance, even when drafts share the same path", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(preferenceChanged({ key: "deleteSourceOnRenderFinish", enabled: true }));
    store.dispatch(editingInstancesAdded([createInstance("a"), createInstance("b")]));
    for (const id of ["a", "b"]) {
      const attempt = createAttempt(id);
      store.dispatch(editingInstanceExportAttemptQueued({ id, attempt }));
      enqueueExport(id, attempt, store.dispatch, store.getState);
    }
    mocks.renderFast.mockResolvedValue({
      displayName: "out",
      displayPath: "out",
      operationId: "op",
    });
    store.dispatch(startSourceExportQueue("b"));
    await vi.waitFor(() => expect(mocks.releaseExportSource).toHaveBeenCalledTimes(1));
    expect(mocks.renderFast.mock.calls.map((call) => call[1])).toEqual(["b"]);
    expect(store.getState().editingInstances.entities.a?.exportAttempts[0]?.state.status).toBe(
      "queued",
    );
    expect(selectSourceQueueStarted(store.getState(), "a")).toBe(false);
    expect(selectSourceQueueStarted(store.getState(), "b")).toBe(false);
    expect(mocks.moveSourceToTrash).not.toHaveBeenCalled();
    store.dispatch(startSourceExportQueue("a"));
    await vi.waitFor(() => expect(mocks.releaseExportSource).toHaveBeenCalledTimes(2));
    expect(mocks.renderFast.mock.calls.map((call) => call[1])).toEqual(["b", "a"]);
    await vi.waitFor(() =>
      expect(mocks.moveSourceToTrash).toHaveBeenCalledExactlyOnceWith(firstSource.sourcePath),
    );
  });

  it("auto-starts only the source receiving a new export", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(editingInstancesAdded([createInstance("a"), createInstance("b")]));
    const first = createAttempt("a");
    store.dispatch(editingInstanceExportAttemptQueued({ id: "a", attempt: first }));
    enqueueExport("a", first, store.dispatch, store.getState);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: true }));
    mocks.renderFast.mockResolvedValue({
      displayName: "out",
      displayPath: "out",
      operationId: "op",
    });
    const second = createAttempt("b");
    store.dispatch(editingInstanceExportAttemptQueued({ id: "b", attempt: second }));
    enqueueExport("b", second, store.dispatch, store.getState);
    await vi.waitFor(() => expect(mocks.releaseExportSource).toHaveBeenCalledTimes(1));
    expect(mocks.renderFast.mock.calls.map((call) => call[1])).toEqual(["b"]);
    expect(selectSourceQueueStarted(store.getState(), "a")).toBe(false);
    expect(store.getState().editingInstances.entities.a?.exportAttempts[0]?.state.status).toBe(
      "queued",
    );
  });

  it("cancels a waiting source without interrupting another source's render", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(editingInstancesAdded([createInstance("a"), createInstance("b")]));
    for (const id of ["a", "b"]) {
      const attempt = createAttempt(id);
      store.dispatch(editingInstanceExportAttemptQueued({ id, attempt }));
      enqueueExport(id, attempt, store.dispatch, store.getState);
    }
    let finish = () => {};
    mocks.renderFast.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ displayName: "out", displayPath: "out", operationId: "op" });
        }),
    );
    store.dispatch(startSourceExportQueue("a"));
    store.dispatch(startSourceExportQueue("b"));
    await store.dispatch(cancelSourceExportQueue("b"));
    expect(mocks.cancelOperation).not.toHaveBeenCalled();
    expect(selectSourceQueueStarted(store.getState(), "a")).toBe(true);
    expect(selectSourceQueueStarted(store.getState(), "b")).toBe(false);
    finish();
    await vi.waitFor(() => expect(mocks.releaseExportSource).toHaveBeenCalledTimes(1));
    expect(mocks.renderFast).toHaveBeenCalledTimes(1);
    expect(store.getState().editingInstances.entities.b?.exportAttempts[0]?.state.status).toBe(
      "queued",
    );
  });

  it("stops one source in place while another started source continues", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(editingInstancesAdded([createInstance("a"), createInstance("b")]));
    for (const [id, attemptId] of [
      ["a", "a1"],
      ["a", "a2"],
      ["b", "b1"],
    ] as const) {
      const attempt = createAttempt(attemptId);
      store.dispatch(editingInstanceExportAttemptQueued({ id, attempt }));
      enqueueExport(id, attempt, store.dispatch, store.getState);
    }
    let finish = () => {};
    mocks.renderFast
      .mockImplementationOnce((_request, _output, onProgress) => {
        onProgress(progress("op-a", 3));
        return new Promise((resolve) => {
          finish = () => resolve({ displayName: "out", displayPath: "out", operationId: "op-a" });
        });
      })
      .mockResolvedValue({ displayName: "out", displayPath: "out", operationId: "op" });
    store.dispatch(startSourceExportQueue("a"));
    store.dispatch(startSourceExportQueue("b"));
    const stopping = store.dispatch(cancelSourceExportQueue("a"));
    finish();
    await stopping;
    await vi.waitFor(() => expect(mocks.renderFast).toHaveBeenCalledTimes(2));
    expect(mocks.renderFast.mock.calls.map((call) => call[1])).toEqual(["a1", "b1"]);
    expect(
      store
        .getState()
        .editingInstances.entities.a?.exportAttempts.map((attempt) => [
          attempt.id,
          attempt.state.status,
          attempt.metrics.progressPercent,
        ]),
    ).toEqual([
      ["a1", "queued", 0],
      ["a2", "queued", 0],
    ]);
    expect(selectSourceQueueStarted(store.getState(), "a")).toBe(false);
    expect(mocks.cancelOperation).toHaveBeenCalledWith("op-a");
    store.dispatch(startSourceExportQueue("a"));
    await vi.waitFor(() => expect(mocks.renderFast).toHaveBeenCalledTimes(4));
    expect(mocks.renderFast.mock.calls.map((call) => call[1])).toEqual(["a1", "b1", "a1", "a2"]);
    await vi.waitFor(() => expect(mocks.releaseExportSource).toHaveBeenCalledTimes(3));
  });

  it("global cancellation overrides an in-flight source requeue", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(editingInstancesAdded([createInstance("a"), createInstance("b")]));
    for (const id of ["a", "b"]) {
      const attempt = createAttempt(id);
      store.dispatch(editingInstanceExportAttemptQueued({ id, attempt }));
      enqueueExport(id, attempt, store.dispatch, store.getState);
    }
    let finish = () => {};
    mocks.renderFast.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ displayName: "out", displayPath: "out", operationId: "op" });
        }),
    );
    store.dispatch(startSourceExportQueue("a"));
    const stopping = store.dispatch(cancelSourceExportQueue("a"));
    store.dispatch(cancelAllExportsRequested());
    finish();
    await stopping;
    await vi.waitFor(() => expect(mocks.releaseExportSource).toHaveBeenCalledTimes(2));
    expect(selectQueueStarted(store.getState())).toBe(false);
    expect(store.getState().editingInstances.entities.a?.exportAttempts[0]?.state.status).toBe(
      "canceled",
    );
    expect(store.getState().editingInstances.entities.b?.exportAttempts[0]?.state.status).toBe(
      "canceled",
    );
    store.dispatch(startSourceExportQueue("a"));
    expect(mocks.renderFast).toHaveBeenCalledTimes(1);
    expect(mocks.performQueueFinishAction).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "deletes only after the last same-source export (separate draft: %s)",
    async (separateDraft) => {
      const store = createAppStore();
      store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
      store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
      store.dispatch(preferenceChanged({ key: "deleteSourceOnRenderFinish", enabled: true }));
      store.dispatch(editingInstancesAdded([createInstance("first"), createInstance("second")]));
      const finish: Array<() => void> = [];
      mocks.renderFast.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish.push(() =>
              resolve({ displayName: "out", displayPath: "out", operationId: "op" }),
            );
          }),
      );
      for (const [index, attempt] of [createAttempt("one"), createAttempt("two")].entries()) {
        const id = separateDraft && index === 1 ? "second" : "first";
        store.dispatch(editingInstanceExportAttemptQueued({ id, attempt }));
        enqueueExport(id, attempt, store.dispatch, store.getState);
      }
      setExportQueueExecutionEnabled(true, store.dispatch, store.getState);
      setExportQueueExecutionEnabled(false, store.dispatch, store.getState);
      finish[0]!();
      await vi.waitFor(() =>
        expect(
          store.getState().editingInstances.entities.first?.exportAttempts[0]?.state.status,
        ).toBe("completed"),
      );
      expect(mocks.moveSourceToTrash).not.toHaveBeenCalled();
      expect(mocks.renderFast).toHaveBeenCalledTimes(1);
      setExportQueueExecutionEnabled(true, store.dispatch, store.getState);
      await vi.waitFor(() => expect(finish).toHaveLength(2));
      expect(mocks.moveSourceToTrash).not.toHaveBeenCalled();
      finish[1]!();
      await vi.waitFor(() =>
        expect(mocks.moveSourceToTrash).toHaveBeenCalledExactlyOnceWith(firstSource.sourcePath),
      );
      expect(store.getState().editingInstances.entities.first?.sourceAvailability).toBe("deleted");
      expect(store.getState().editingInstances.entities.second?.sourceAvailability).toBe("deleted");
    },
  );

  it("withdraws only the selected pending job while another export of the same instance runs", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(editingInstancesAdded([createInstance("source")]));
    const attempts = [createAttempt("one"), createAttempt("two"), createAttempt("three")];
    for (const attempt of attempts) {
      store.dispatch(editingInstanceExportAttemptQueued({ id: "source", attempt }));
      expect(enqueueExport("source", attempt, store.dispatch, store.getState)).toBe(true);
    }
    let finish: () => void = () => undefined;
    mocks.renderFast
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = () =>
              resolve({ displayName: "one", displayPath: "one", operationId: "op-one" });
          }),
      )
      .mockResolvedValue({ displayName: "three", displayPath: "three", operationId: "op-three" });
    setExportQueueExecutionEnabled(true, store.dispatch, store.getState);
    expect(withdrawPendingExport("source", "one", store.getState)).toBe(false);
    expect(withdrawPendingExport("source", "two", store.getState)).toBe(true);
    finish();
    await vi.waitFor(() => expect(mocks.renderFast).toHaveBeenCalledTimes(2));
    expect(mocks.renderFast.mock.calls.map((call) => call[1])).toEqual(["one", "three"]);
    await vi.waitFor(() => expect(mocks.releaseExportSource).toHaveBeenCalledTimes(3));
  });
  it("runs pending exports in order and keeps one active job per instance", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const getState = store.getState;
    const first = createAttempt("attempt-1");
    const second = createAttempt("attempt-2", secondSource.sourcePath);
    store.dispatch(
      editingInstancesAdded([createInstance("instance-1"), createInstance("instance-2")]),
    );
    store.dispatch(editingInstanceExportAttemptQueued({ id: "instance-1", attempt: first }));
    store.dispatch(editingInstanceExportAttemptQueued({ id: "instance-2", attempt: second }));
    mocks.renderFast.mockImplementation(async (request: { sourcePath: string }) => ({
      displayName: "output.mp4",
      displayPath: "C:/Exports/output.mp4",
      operationId: `operation-${request.sourcePath}`,
    }));

    setExportQueueExecutionEnabled(true, store.dispatch, getState);
    enqueueExport("instance-1", first, store.dispatch, getState);
    enqueueExport("instance-1", first, store.dispatch, getState);
    enqueueExport("instance-2", second, store.dispatch, getState);

    await vi.waitFor(() => expect(mocks.renderFast).toHaveBeenCalledTimes(2));
    expect(mocks.renderFast.mock.calls.map(([request]) => request.sourcePath)).toEqual([
      firstSource.sourcePath,
      secondSource.sourcePath,
    ]);
    expect(
      store.getState().editingInstances.entities["instance-1"]?.exportAttempts[0]?.state.status,
    ).toBe("completed");
    expect(
      store.getState().editingInstances.entities["instance-2"]?.exportAttempts[0]?.state.status,
    ).toBe("completed");
    expect(mocks.startOperation).toHaveBeenNthCalledWith(
      1,
      "ffmpeg.export",
      expect.objectContaining({
        data: expect.objectContaining({
          outputPath: "C:/Exports/attempt-1.mp4",
        }),
      }),
    );
  });

  it("releases a queued reservation when cancellation happens before native start", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const getState = store.getState;
    const attempt = createAttempt("attempt-cancel");
    store.dispatch(editingInstancesAdded([createInstance("instance-cancel")]));
    store.dispatch(editingInstanceExportAttemptQueued({ id: "instance-cancel", attempt }));

    enqueueExport("instance-cancel", attempt, store.dispatch, getState);
    await cancelQueuedExport("instance-cancel", attempt.id, getState);

    expect(mocks.renderFast).not.toHaveBeenCalled();
    expect(mocks.releaseExportSource).toHaveBeenCalledWith(firstSource.sourcePath);
    expect(
      store.getState().editingInstances.entities["instance-cancel"]?.exportAttempts[0]?.state
        .status,
    ).toBe("canceled");
  });

  it("requeues the active attempt after cancellation without removing its reservation", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const getState = store.getState;
    const attempt = createAttempt("attempt-requeue");
    let resolveRender: (result: {
      displayName: string;
      displayPath: string;
      operationId: string;
    }) => void = () => undefined;

    let onProgress: ((value: ExportProgress) => void) | undefined;

    mocks.renderFast
      .mockImplementationOnce(
        async (
          _request: unknown,
          _outputId: string,
          progressCallback: (value: ExportProgress) => void,
        ) => {
          onProgress = progressCallback;
          return new Promise((resolve) => {
            resolveRender = resolve;
          });
        },
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRender = resolve;
          }),
      );
    store.dispatch(editingInstancesAdded([createInstance("instance-requeue")]));
    store.dispatch(editingInstanceExportAttemptQueued({ id: "instance-requeue", attempt }));
    setExportQueueExecutionEnabled(true, store.dispatch, getState);
    enqueueExport("instance-requeue", attempt, store.dispatch, getState);

    await vi.waitFor(() => expect(onProgress).toBeDefined());
    onProgress!(progress("op-1", 1));
    setExportQueueExecutionEnabled(false, store.dispatch, getState);
    const requeue = cancelAndRequeueExport("instance-requeue", attempt.id, getState);
    resolveRender({ displayName: "output", displayPath: "output", operationId: "op-1" });
    await requeue;

    expect(mocks.cancelOperation).toHaveBeenCalledWith("op-1");
    expect(mocks.renderFast).toHaveBeenCalledTimes(1);
    expect(
      store.getState().editingInstances.entities["instance-requeue"]?.exportAttempts[0]?.state
        .status,
    ).toBe("queued");
    expect(mocks.releaseExportSource).not.toHaveBeenCalled();

    setExportQueueExecutionEnabled(true, store.dispatch, getState);
    await vi.waitFor(() => expect(mocks.renderFast).toHaveBeenCalledTimes(2));
    onProgress!(progress("op-1", 9));
    expect(
      store.getState().editingInstances.entities["instance-requeue"]?.exportAttempts[0]?.metrics
        .progressPercent,
    ).toBe(0);
    resolveRender({ displayName: "output", displayPath: "output", operationId: "op-2" });
    await vi.waitFor(() => expect(mocks.releaseExportSource).toHaveBeenCalledTimes(1));
  });

  it("ignores a late progress callback with a different native operation id", async () => {
    const store = createAppStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const getState = store.getState;
    const attempt = createAttempt("attempt-stale");
    let resolveRender: (result: {
      displayName: string;
      displayPath: string;
      operationId: string;
    }) => void = () => undefined;

    let onProgress: ((value: ExportProgress) => void) | undefined;
    mocks.renderFast.mockImplementation(
      async (
        _request: unknown,
        _outputId: string,
        progressCallback: (value: ExportProgress) => void,
      ) => {
        onProgress = progressCallback;
        return new Promise((resolve) => {
          resolveRender = resolve;
        });
      },
    );
    store.dispatch(editingInstancesAdded([createInstance("instance-stale")]));
    store.dispatch(editingInstanceExportAttemptQueued({ id: "instance-stale", attempt }));
    setExportQueueExecutionEnabled(true, store.dispatch, getState);
    enqueueExport("instance-stale", attempt, store.dispatch, getState);

    await vi.waitFor(() => expect(onProgress).toBeDefined());
    onProgress!(progress("operation-current", 4));
    onProgress!(progress("operation-stale", 99));
    expect(
      store.getState().editingInstances.entities["instance-stale"]?.exportAttempts[0]?.metrics
        .currentFrame,
    ).toBe(4);

    resolveRender({
      displayName: "output.mp4",
      displayPath: "C:/Exports/output.mp4",
      operationId: "operation-current",
    });
    await vi.waitFor(() =>
      expect(
        store.getState().editingInstances.entities["instance-stale"]?.exportAttempts[0]?.state
          .status,
      ).toBe("completed"),
    );
  });
});
