import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chooseOutputPath: vi.fn(),
  reserveExportSource: vi.fn(),
  releaseExportSource: vi.fn(),
  cancelOperation: vi.fn(),
  planOptimizedExport: vi.fn(),
  renderFast: vi.fn(),
  renderOptimized: vi.fn(),
  availableQueueFinishActions: vi.fn(),
  performQueueFinishAction: vi.fn(),
}));

vi.mock("@/lib/tauri/media", () => ({
  chooseOutputPath: mocks.chooseOutputPath,
  reserveExportSource: mocks.reserveExportSource,
  releaseExportSource: mocks.releaseExportSource,
  cancelOperation: mocks.cancelOperation,
  planOptimizedExport: mocks.planOptimizedExport,
  renderFast: mocks.renderFast,
  renderOptimized: mocks.renderOptimized,
  normalizeAppError: (error: unknown) =>
    typeof error === "object" && error !== null && "message" in error
      ? { code: "internal", message: String(error.message) }
      : { code: "internal", message: String(error) },
}));
vi.mock("@/lib/tauri/queue", () => ({
  availableQueueFinishActions: mocks.availableQueueFinishActions,
  performQueueFinishAction: mocks.performQueueFinishAction,
}));

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  selectActiveExport,
  selectExportQueue,
  selectOptimizedExportDialogOpen,
} from "@/app/store/slices/export-slice";
import {
  cancelActiveExportRequested,
  openOptimizedExportDialog,
  startExportQueue,
  startFastCutRequested,
  startOptimizedExportRequested,
} from "@/app/store/thunks/export-thunks";
import { createAppStore } from "@/app/store/store";
import { resetExportQueueRuntimeForTests } from "@/features/export/utils/export-queue";
import type { MediaInfo } from "@/lib/tauri/media";

const media: MediaInfo = {
  sourceId: "source-1",
  formatName: "matroska",
  durationMicros: 1_000_000,
  video: {
    streamIndex: 0,
    codecName: "h264",
    width: 1920,
    height: 1080,
    averageFrameRate: { numerator: 30, denominator: 1 },
  },
  audioStreams: [],
  chapters: [],
};

const output = {
  outputId: "output-1",
  displayName: "clip.mkv",
  displayPath: "C:/Exports/clip.mkv",
};

function createReadyStore() {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });
  store.dispatch(sourceSelected({ source: { sourceId: "source-1", displayName: "source.mp4" } }));
  store.dispatch(sourceReady({ sourceId: "source-1", media }));
  return store;
}

beforeEach(() => {
  resetExportQueueRuntimeForTests();
  vi.clearAllMocks();
  mocks.chooseOutputPath.mockResolvedValue(output);
  mocks.reserveExportSource.mockResolvedValue(undefined);
  mocks.releaseExportSource.mockResolvedValue(undefined);
  mocks.cancelOperation.mockResolvedValue(undefined);
  mocks.planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg -i <source> <output>" });
  mocks.availableQueueFinishActions.mockResolvedValue(["exit", "nothing"]);
});

describe("export thunks and runtime queue", () => {
  it("runs Fast Cut through the typed adapter and publishes lifecycle state", async () => {
    mocks.renderFast.mockImplementation(async (_request, _outputId, onProgress) => {
      onProgress({ operationId: "operation-1", elapsedMicros: 500_000, phase: "running" });
      return {
        operationId: "operation-1",
        displayName: output.displayName,
        displayPath: output.displayPath,
      };
    });
    const store = createReadyStore();

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    expect(selectExportQueue(store.getState())[0]?.request.trim).toEqual({
      startMicros: 0,
      endMicros: 1_000_000,
    });
    store.dispatch(startExportQueue());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState())[0]?.status).toBe("completed"),
    );

    expect(mocks.reserveExportSource).toHaveBeenCalledWith("source-1");
    expect(mocks.renderFast).toHaveBeenCalledOnce();
    expect(selectExportQueue(store.getState())[0]?.progressPercent).toBe(100);
  });

  it("opens, plans, configures, and starts optimized export without a controller ref", async () => {
    mocks.renderOptimized.mockResolvedValue({
      operationId: "operation-2",
      displayName: "clip.mkv",
      displayPath: "C:/Exports/clip.mkv",
    });
    const store = createReadyStore();

    await store.dispatch(openOptimizedExportDialog());
    expect(selectOptimizedExportDialogOpen(store.getState())).toBe(true);
    expect(store.getState().export.commandPreview).toContain("ffmpeg");

    store.dispatch(startOptimizedExportRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    expect(selectExportQueue(store.getState())[0]?.route).toBe("optimized");
    store.dispatch(startExportQueue());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState())[0]?.status).toBe("completed"),
    );

    expect(mocks.planOptimizedExport).toHaveBeenCalled();
    expect(mocks.renderOptimized).toHaveBeenCalledOnce();
  });

  it("keeps queued jobs sequential and reports native failures", async () => {
    mocks.chooseOutputPath
      .mockResolvedValueOnce({ ...output, outputId: "output-1", displayName: "one.mkv" })
      .mockResolvedValueOnce({ ...output, outputId: "output-2", displayName: "two.mkv" });
    mocks.renderFast
      .mockResolvedValueOnce({
        operationId: "operation-1",
        displayName: "one.mkv",
        displayPath: "one.mkv",
      })
      .mockRejectedValueOnce({ message: "native failure" });
    const store = createReadyStore();

    store.dispatch(startFastCutRequested());
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(2));
    store.dispatch(startExportQueue());
    await vi.waitFor(() => expect(selectActiveExport(store.getState())).toBeUndefined());

    expect(selectExportQueue(store.getState()).map((item) => item.status)).toEqual([
      "completed",
      "failed",
    ]);
    expect(mocks.renderFast).toHaveBeenCalledTimes(2);
  });

  it("keeps cancellation synchronized with the native operation", async () => {
    let finishRender!: (value: unknown) => void;
    mocks.renderFast.mockImplementation(
      (_request, _outputId, onProgress) =>
        new Promise((resolve) => {
          finishRender = resolve;
          onProgress({ operationId: "operation-cancel", elapsedMicros: 1, phase: "running" });
        }),
    );
    const store = createReadyStore();
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    store.dispatch(startExportQueue());
    await vi.waitFor(() => expect(selectActiveExport(store.getState())).toBeDefined());

    store.dispatch(cancelActiveExportRequested());
    expect(selectExportQueue(store.getState())[0]?.status).toBe("canceled");
    expect(mocks.cancelOperation).toHaveBeenCalledWith("operation-cancel");
    finishRender({
      operationId: "operation-cancel",
      displayName: "clip.mkv",
      displayPath: output.displayPath,
    });
  });
});
