import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chooseOutputPath: vi.fn(),
  moveSourceToTrash: vi.fn(),
  reserveExportSource: vi.fn(),
  releaseExportSource: vi.fn(),
  cancelOperation: vi.fn(),
  planOptimizedExport: vi.fn(),
  activateSourcePath: vi.fn(),
  activateSource: vi.fn(),
  activateImportedItemRequested: vi.fn(),
  leaveActiveImportedItem: vi.fn(),
  navigateToImportedItem: vi.fn(),
  restoreActiveImportedItemRequested: vi.fn(),
  renderFast: vi.fn(),
  renderOptimized: vi.fn(),
  availableQueueFinishActions: vi.fn(),
  performQueueFinishAction: vi.fn(),
}));

vi.mock("@/lib/tauri/media", () => ({
  chooseOutputPath: mocks.chooseOutputPath,
  moveSourceToTrash: mocks.moveSourceToTrash,
  reserveExportSource: mocks.reserveExportSource,
  releaseExportSource: mocks.releaseExportSource,
  cancelOperation: mocks.cancelOperation,
  planOptimizedExport: mocks.planOptimizedExport,
  activateSourcePath: mocks.activateSourcePath,
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
vi.mock("@/app/store/thunks/source-media-thunks", () => ({
  activateImportedItemRequested: mocks.activateImportedItemRequested,
  activateSource: mocks.activateSource,
  leaveActiveImportedItem: mocks.leaveActiveImportedItem,
  navigateToImportedItem: mocks.navigateToImportedItem,
  restoreActiveImportedItemRequested: mocks.restoreActiveImportedItemRequested,
}));

import { importQueueItemActivated } from "@/app/store/actions/imported-queue-actions";
import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  activeQueueItemChanged,
  type ExportQueueItem,
  type importQueueItem,
  importQueueItemAdded,
  importQueueItemRemoved,
  queueEntryAdded,
  queueFinishActionChanged,
  selectActiveItemId,
  selectExportQueue,
  selectImportQueueItems,
  selectOptimizedExportDialogOpen,
  selectQueueStarted,
} from "@/app/store/slices/export-slice";
import { preferenceChanged } from "@/app/store/slices/preferences-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import { createAppStore } from "@/app/store/store";
import {
  cancelActiveExportRequested,
  cancelAllExportsRequested,
  cancelExportRequested,
  openOptimizedExportDialog,
  restoreExportQueueItemRequested,
  startExportQueue,
  startFastCutRequested,
  startOptimizedExportRequested,
} from "@/app/store/thunks/export-thunks";
import type { MediaInfo } from "@/lib/tauri/media.types";

const media: MediaInfo = {
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

const queuedItem: ExportQueueItem = {
  addedAt: 1,
  id: "export-queued",
  snapshot: {
    source: { displayName: "source.mp4", sourcePath: "C:/Media/source.mp4" },
    trim: { startMicros: 0, endMicros: 1_000_000 },
    crop: null,
    audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
  },
  route: "fast",
  request: {
    sourcePath: "C:/Media/source.mp4",
    trim: { startMicros: 0, endMicros: 1_000_000 },
    audioTracks: [],
    mergeAudio: false,
  },
  outputId: output.outputId,
  filename: output.displayName,
  path: output.displayPath,
  status: "queued",
  operationId: null,
  startedAt: null,
  durationMs: null,
  progressPercent: 0,
};

const importedItem: importQueueItem = {
  id: "import-1",
  status: "imported",
  origin: "source-import",
  snapshot: queuedItem.snapshot,
};

const historyForkItem: importQueueItem = {
  ...importedItem,
  id: "fork-1",
  origin: "history-fork",
};

function createReadyStore(withImportedItem = true) {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  store.dispatch(
    sourceSelected({
      source: {
        displayName: "source.mp4",
        sourcePath: "C:/Media/source.mp4",
      },
    }),
  );
  store.dispatch(sourceReady({ loadToken: 1, media }));
  if (withImportedItem) store.dispatch(importQueueItemAdded(importedItem));
  return store;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.chooseOutputPath.mockResolvedValue(output);
  mocks.moveSourceToTrash.mockResolvedValue(undefined);
  mocks.reserveExportSource.mockResolvedValue(undefined);
  mocks.releaseExportSource.mockResolvedValue(undefined);
  mocks.cancelOperation.mockResolvedValue(undefined);
  mocks.planOptimizedExport.mockResolvedValue({ commandPreview: "ffmpeg -i <source> <output>" });
  mocks.activateSourcePath.mockReset();
  mocks.activateSource.mockReset();
  mocks.activateImportedItemRequested.mockReset();
  mocks.activateImportedItemRequested.mockImplementation((item: importQueueItem) => {
    return (dispatch: AppDispatch) => {
      dispatch(
        importQueueItemActivated({
          id: item.id,
          loadToken: 2,
          media: item.media ?? media,
          snapshot: item.snapshot,
        }),
      );
      dispatch(
        sourceReady({
          loadToken: 2,
          media: item.media ?? media,
          snapshot: item.snapshot,
        }),
      );
      return Promise.resolve(true);
    };
  });
  mocks.leaveActiveImportedItem.mockReset();
  mocks.leaveActiveImportedItem.mockImplementation(
    () => (dispatch: AppDispatch, getState: () => RootState) => {
      const active = getState().export.queue.find(
        (item) => item.id === getState().export.activeItemId,
      );

      if (active?.status === "imported" && active.origin === "history-fork") {
        dispatch(importQueueItemRemoved(active.id));
      }
    },
  );
  mocks.navigateToImportedItem.mockReset();
  mocks.navigateToImportedItem.mockImplementation((id: string | null) => {
    return (dispatch: AppDispatch) => {
      dispatch(activeQueueItemChanged(id));
      return true;
    };
  });
  mocks.availableQueueFinishActions.mockResolvedValue(["exit", "nothing"]);
  mocks.performQueueFinishAction.mockResolvedValue(undefined);
});

describe("export thunks and runtime queue", () => {
  it("promotes an imported item in place and leaves canceled output selection imported", async () => {
    const store = createReadyStore(false);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(importQueueItemAdded(importedItem));
    mocks.chooseOutputPath.mockResolvedValueOnce(null);

    store.dispatch(startFastCutRequested());
    await Promise.resolve();
    expect(selectImportQueueItems(store.getState())).toEqual([importedItem]);
    expect(selectActiveItemId(store.getState())).toBe(importedItem.id);

    mocks.chooseOutputPath.mockResolvedValue(output);
    mocks.renderFast.mockResolvedValue({
      operationId: "operation-promoted",
      displayName: output.displayName,
      displayPath: output.displayPath,
    });
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));

    const promoted = selectExportQueue(store.getState())[0];
    expect(promoted?.id).toBe(importedItem.id);
    expect(promoted?.status).toBe("queued");
    expect(promoted?.snapshot).toEqual(importedItem.snapshot);
    expect(selectImportQueueItems(store.getState())).toHaveLength(0);
    expect(selectActiveItemId(store.getState())).toBe(importedItem.id);
    expect(mocks.navigateToImportedItem).not.toHaveBeenCalled();
  });

  it("promotes optimized export using the same queue item id", async () => {
    const store = createReadyStore(false);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(importQueueItemAdded(importedItem));
    mocks.renderOptimized.mockResolvedValue({
      operationId: "operation-optimized-promoted",
      displayName: output.displayName,
      displayPath: output.displayPath,
    });

    store.dispatch(startOptimizedExportRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));

    expect(selectExportQueue(store.getState())[0]).toMatchObject({
      id: importedItem.id,
      status: "queued",
      route: "optimized",
      snapshot: importedItem.snapshot,
    });
    expect(selectImportQueueItems(store.getState())).toHaveLength(0);
    expect(selectActiveItemId(store.getState())).toBe(importedItem.id);
    expect(mocks.navigateToImportedItem).not.toHaveBeenCalled();
  });

  it("promotes a history fork through Fast Cut using the same id", async () => {
    const store = createReadyStore(false);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(importQueueItemAdded(historyForkItem));

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));

    const promoted = selectExportQueue(store.getState())[0];
    expect(promoted?.id).toBe(historyForkItem.id);
    expect(promoted).not.toHaveProperty("origin");
    expect(selectImportQueueItems(store.getState())).toHaveLength(0);
  });

  it("promotes a history fork through Optimized Export using the same id", async () => {
    const store = createReadyStore(false);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(importQueueItemAdded(historyForkItem));

    store.dispatch(startOptimizedExportRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));

    expect(selectExportQueue(store.getState())[0]).toMatchObject({
      id: historyForkItem.id,
      status: "queued",
      route: "optimized",
    });
    expect(selectImportQueueItems(store.getState())).toHaveLength(0);
  });

  it("keeps a history fork active when Fast Cut output selection is canceled", async () => {
    const store = createReadyStore(false);
    store.dispatch(importQueueItemAdded(historyForkItem));
    mocks.chooseOutputPath.mockResolvedValueOnce(null);

    store.dispatch(startFastCutRequested());
    await Promise.resolve();

    expect(selectImportQueueItems(store.getState())).toEqual([historyForkItem]);
    expect(selectActiveItemId(store.getState())).toBe(historyForkItem.id);
  });

  it("keeps a history fork active when Optimized Export output selection is canceled", async () => {
    const store = createReadyStore(false);
    store.dispatch(importQueueItemAdded(historyForkItem));
    mocks.chooseOutputPath.mockResolvedValueOnce(null);

    store.dispatch(startOptimizedExportRequested());
    await Promise.resolve();

    expect(selectImportQueueItems(store.getState())).toEqual([historyForkItem]);
    expect(selectActiveItemId(store.getState())).toBe(historyForkItem.id);
  });

  it("selects the next imported item after promotion", async () => {
    const store = createReadyStore(false);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const nextItem: importQueueItem = {
      ...importedItem,
      id: "import-2",
      snapshot: {
        ...importedItem.snapshot,
        source: { displayName: "next.mp4", sourcePath: "C:/Media/next.mp4" },
      },
    };

    store.dispatch(importQueueItemAdded(importedItem));
    store.dispatch(importQueueItemAdded(nextItem));
    store.dispatch(activeQueueItemChanged(importedItem.id));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));

    expect(mocks.navigateToImportedItem).toHaveBeenCalledWith(nextItem.id);
    expect(selectActiveItemId(store.getState())).toBe(nextItem.id);
  });

  it("uses the shared replacement rule after optimized promotion", async () => {
    const store = createReadyStore(false);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const middleItem = { ...importedItem, id: "import-middle" };
    const nextItem = { ...importedItem, id: "import-next" };
    store.dispatch(importQueueItemAdded(importedItem));
    store.dispatch(importQueueItemAdded(middleItem));
    store.dispatch(importQueueItemAdded(nextItem));
    store.dispatch(activeQueueItemChanged(middleItem.id));

    store.dispatch(startOptimizedExportRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));

    expect(mocks.navigateToImportedItem).toHaveBeenCalledWith(nextItem.id);
    expect(selectActiveItemId(store.getState())).toBe(nextItem.id);
    expect(selectImportQueueItems(store.getState()).map((item) => item.id)).toEqual([
      importedItem.id,
      nextItem.id,
    ]);
  });

  it("does not execute imported-only items as exports", () => {
    const store = createReadyStore(false);
    store.dispatch(importQueueItemAdded(importedItem));

    store.dispatch(startExportQueue());

    expect(selectQueueStarted(store.getState())).toBe(false);
    expect(mocks.renderFast).not.toHaveBeenCalled();
  });

  it("starts the queue when an entry is added with auto-start enabled", async () => {
    const store = createReadyStore();

    store.dispatch(queueEntryAdded(queuedItem));
    await vi.waitFor(() => expect(selectQueueStarted(store.getState())).toBe(true));

    expect(selectExportQueue(store.getState())[0]?.status).toBe("queued");
  });

  it("leaves an entry queued when auto-start is disabled", async () => {
    const store = createReadyStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));

    store.dispatch(queueEntryAdded(queuedItem));
    await Promise.resolve();

    expect(selectQueueStarted(store.getState())).toBe(false);
    expect(selectExportQueue(store.getState())[0]?.status).toBe("queued");
  });

  it("keeps startExportQueue guarded when no queued entries exist", () => {
    const store = createReadyStore();

    store.dispatch(startExportQueue());

    expect(selectQueueStarted(store.getState())).toBe(false);
  });

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
    store.dispatch(queueFinishActionChanged("exit"));

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    expect(selectExportQueue(store.getState())[0]?.request.trim).toEqual({
      startMicros: 0,
      endMicros: 1_000_000,
    });
    expect(selectExportQueue(store.getState())[0]?.snapshot).toEqual({
      source: { displayName: "source.mp4", sourcePath: "C:/Media/source.mp4" },
      trim: { startMicros: 0, endMicros: 1_000_000 },
      crop: null,
      audio: {
        master: { enabled: true, volumePercent: 50 },
        tracks: [],
        mergeAudio: false,
      },
    });
    store.dispatch(startExportQueue());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState())[0]?.status).toBe("completed"),
    );

    expect(selectQueueStarted(store.getState())).toBe(false);
    expect(mocks.reserveExportSource).toHaveBeenCalledWith("C:/Media/source.mp4");
    expect(mocks.renderFast).toHaveBeenCalledOnce();
    expect(selectExportQueue(store.getState())[0]?.progressPercent).toBe(100);
    await vi.waitFor(() => expect(mocks.performQueueFinishAction).toHaveBeenCalledWith("exit"));
  });

  it("deletes the source after a successful render when confirmed", async () => {
    mocks.renderFast.mockResolvedValue({
      operationId: "operation-delete-source",
      displayName: output.displayName,
      displayPath: output.displayPath,
    });
    const store = createReadyStore();
    store.dispatch(preferenceChanged({ enabled: true, key: "deleteSourceOnRenderFinish" }));

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    store.dispatch(startExportQueue());

    await vi.waitFor(() =>
      expect(mocks.moveSourceToTrash).toHaveBeenCalledWith("C:/Media/source.mp4"),
    );
    expect(selectExportQueue(store.getState())[0]?.sourceDeleted).toBe(true);
  });

  it("restores a queued snapshot after importing its source", async () => {
    const source = {
      displayName: "other.mp4",
      sourcePath: "C:/Media/other.mp4",
    };

    const store = createReadyStore(false);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    const historicalItem = {
      ...queuedItem,
      snapshot: {
        ...queuedItem.snapshot,
        source: { ...source },
        trim: { startMicros: 250_000, endMicros: 1_750_000 },
      },
    };

    store.dispatch(queueEntryAdded(historicalItem));

    await expect(store.dispatch(restoreExportQueueItemRequested(queuedItem.id))).resolves.toBe(
      true,
    );

    expect(mocks.activateImportedItemRequested).toHaveBeenCalledWith(
      expect.objectContaining({ snapshot: historicalItem.snapshot }),
    );
    expect(store.getState().source.source).toEqual(source);
    expect(selectTrim(store.getState())).toMatchObject({
      startMicros: 250_000,
      endMicros: 1_750_000,
    });
    expect(selectExportQueue(store.getState())).toHaveLength(1);
    expect(selectExportQueue(store.getState())[0]).toEqual(historicalItem);
    const [fork] = selectImportQueueItems(store.getState());
    expect(fork).toMatchObject({
      status: "imported",
      origin: "history-fork",
      snapshot: historicalItem.snapshot,
    });
    expect(fork?.id).not.toBe(historicalItem.id);
    expect(selectActiveItemId(store.getState())).toBe(fork?.id);
  });

  it("creates a fresh fork for every repeated history open", async () => {
    const source = {
      displayName: "history.mp4",
      sourcePath: "C:/Media/history.mp4",
    };

    const historicalItem = {
      ...queuedItem,
      snapshot: { ...queuedItem.snapshot, source },
    };

    const secondHistoryItem = { ...historicalItem, addedAt: 2, id: "export-second" };
    const store = createReadyStore(false);
    store.dispatch(queueEntryAdded(historicalItem));

    await expect(store.dispatch(restoreExportQueueItemRequested(historicalItem.id))).resolves.toBe(
      true,
    );
    const firstFork = selectImportQueueItems(store.getState())[0];
    store.dispatch(queueEntryAdded(secondHistoryItem));

    await expect(
      store.dispatch(restoreExportQueueItemRequested(secondHistoryItem.id)),
    ).resolves.toBe(true);

    const importedItems = selectImportQueueItems(store.getState());
    expect(importedItems).toHaveLength(1);
    expect(importedItems[0]?.origin).toBe("history-fork");
    expect(importedItems[0]?.id).not.toBe(firstFork?.id);
    expect(selectExportQueue(store.getState())).toEqual([secondHistoryItem, historicalItem]);
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

    expect(mocks.planOptimizedExport).toHaveBeenCalledTimes(1);
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
    const store = createReadyStore(false);
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));

    store.dispatch(importQueueItemAdded(importedItem));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    store.dispatch(importQueueItemAdded({ ...importedItem, id: "import-2" }));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(2));
    store.dispatch(startExportQueue());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState()).some((item) => item.status === "rendering")).toBe(
        false,
      ),
    );

    expect(selectExportQueue(store.getState()).map((item) => item.status)).toEqual([
      "failed",
      "completed",
    ]);
    expect(selectQueueStarted(store.getState())).toBe(false);
    expect(mocks.renderFast).toHaveBeenCalledTimes(2);
  });

  it("keeps the queue running while another processable item remains", async () => {
    let finishFirst!: (value: unknown) => void;
    let finishSecond!: (value: unknown) => void;
    mocks.renderFast
      .mockImplementationOnce(
        (_request, _outputId, onProgress) =>
          new Promise((resolve) => {
            finishFirst = resolve;
            onProgress({ operationId: "operation-1", elapsedMicros: 1, phase: "running" });
          }),
      )
      .mockImplementationOnce(
        (_request, _outputId, onProgress) =>
          new Promise((resolve) => {
            finishSecond = resolve;
            onProgress({ operationId: "operation-2", elapsedMicros: 1, phase: "running" });
          }),
      );
    const store = createReadyStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    store.dispatch(importQueueItemAdded({ ...importedItem, id: "import-2" }));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(2));
    store.dispatch(startExportQueue());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState()).some((item) => item.status === "rendering")).toBe(
        true,
      ),
    );

    finishFirst({
      operationId: "operation-1",
      displayName: output.displayName,
      displayPath: output.displayPath,
    });
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState())[0]?.status).toBe("rendering"),
    );

    expect(selectQueueStarted(store.getState())).toBe(true);
    finishSecond({
      operationId: "operation-2",
      displayName: output.displayName,
      displayPath: output.displayPath,
    });
    await vi.waitFor(() => expect(selectQueueStarted(store.getState())).toBe(false));
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
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState()).some((item) => item.status === "rendering")).toBe(
        true,
      ),
    );

    store.dispatch(cancelActiveExportRequested());
    expect(selectExportQueue(store.getState())[0]?.status).toBe("canceled");
    expect(mocks.cancelOperation).toHaveBeenCalledWith("operation-cancel");
    finishRender({
      operationId: "operation-cancel",
      displayName: "clip.mkv",
      displayPath: output.displayPath,
    });
    await vi.waitFor(() => expect(selectQueueStarted(store.getState())).toBe(false));
  });

  it("cancels all entries without running the configured finish action", async () => {
    let finishRender!: (value: unknown) => void;
    mocks.renderFast.mockImplementation(
      (_request, _outputId, onProgress) =>
        new Promise((resolve) => {
          finishRender = resolve;
          onProgress({ operationId: "operation-cancel-all", elapsedMicros: 1, phase: "running" });
        }),
    );
    const store = createReadyStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(queueFinishActionChanged("exit"));

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    store.dispatch(importQueueItemAdded({ ...importedItem, id: "import-2" }));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(2));
    store.dispatch(startExportQueue());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState()).some((item) => item.status === "rendering")).toBe(
        true,
      ),
    );

    store.dispatch(cancelAllExportsRequested());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState()).every((item) => item.status === "canceled")).toBe(
        true,
      ),
    );
    expect(selectQueueStarted(store.getState())).toBe(false);

    finishRender({
      operationId: "operation-cancel-all",
      displayName: output.displayName,
      displayPath: output.displayPath,
    });
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState()).some((item) => item.status === "rendering")).toBe(
        false,
      ),
    );
    expect(mocks.performQueueFinishAction).not.toHaveBeenCalled();
  });

  it("cancels a queued item while paused and leaves no work to render", async () => {
    const store = createReadyStore();
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(1));
    const queuedId = selectExportQueue(store.getState())[0]?.id;
    expect(queuedId).toBeDefined();

    store.dispatch(cancelExportRequested(queuedId!));
    await vi.waitFor(() => expect(selectExportQueue(store.getState())[0]?.status).toBe("canceled"));

    expect(selectQueueStarted(store.getState())).toBe(false);
    expect(mocks.renderFast).not.toHaveBeenCalled();
    expect(mocks.releaseExportSource).toHaveBeenCalledWith("C:/Media/source.mp4");
  });

  it("requires a new start signal after the queue becomes idle", async () => {
    mocks.renderFast.mockResolvedValue({
      operationId: "operation-auto",
      displayName: output.displayName,
      displayPath: output.displayPath,
    });
    const store = createReadyStore();

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState())[0]?.status).toBe("completed"),
    );
    expect(selectQueueStarted(store.getState())).toBe(false);

    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(importQueueItemAdded({ ...importedItem, id: "import-2" }));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() => expect(selectExportQueue(store.getState())).toHaveLength(2));
    await Promise.resolve();

    expect(selectExportQueue(store.getState())[0]?.status).toBe("queued");
    expect(selectQueueStarted(store.getState())).toBe(false);
    expect(mocks.renderFast).toHaveBeenCalledOnce();
  });

  it("starts a new execution session when auto-start is enabled after idle", async () => {
    mocks.renderFast.mockResolvedValue({
      operationId: "operation-auto",
      displayName: output.displayName,
      displayPath: output.displayPath,
    });
    const store = createReadyStore();

    store.dispatch(startFastCutRequested());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState())[0]?.status).toBe("completed"),
    );
    expect(selectQueueStarted(store.getState())).toBe(false);

    store.dispatch(importQueueItemAdded({ ...importedItem, id: "import-2" }));
    store.dispatch(startFastCutRequested());
    await vi.waitFor(() =>
      expect(selectExportQueue(store.getState())[1]?.status).toBe("completed"),
    );

    expect(mocks.renderFast).toHaveBeenCalledTimes(2);
    expect(selectQueueStarted(store.getState())).toBe(false);
  });
});
