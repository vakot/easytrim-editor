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
import { createAppStore } from "../../store";
import { createDefaultEditorSnapshot } from "../editor-snapshot";
import {
  cancelQueuedExport,
  enqueueExport,
  setExportQueueExecutionEnabled,
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
  it("runs pending exports in order and keeps one active job per instance", async () => {
    const store = createAppStore();
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

  it("ignores a late progress callback with a different native operation id", async () => {
    const store = createAppStore();
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
