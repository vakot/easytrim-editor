import { beforeEach, describe, expect, it, vi } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import {
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterVolumeChanged,
  selectAudioPreviews,
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { cropChanged, selectCrop } from "@/app/store/slices/crop-slice";
import {
  activeQueueItemChanged,
  type ExportQueueItem,
  importQueueItemAdded,
  queueEntryAdded,
  selectActiveItemId,
  selectExportQueue,
  selectimportQueueItems,
} from "@/app/store/slices/export-slice";
import {
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import {
  selectCapabilities,
  selectHasSource,
  selectSourceError,
  selectSourceMedia,
  selectSourceSelection,
  selectSourceStatus,
} from "@/app/store/slices/source-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import { createAppStore } from "@/app/store/store";
import {
  checkMediaCapabilitiesRequested,
  chooseSourceRequested,
  closeActiveImportedItemRequested,
  handlePreviewPlaybackError,
  ingestSources,
  leaveActiveImportedItem,
  navigateToImportedItem,
  prepareSourceWaveforms,
} from "@/app/store/thunks/source-media-thunks";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import type { SourceRef } from "@/domain/source";
import type { MediaInfo, WaveformResult } from "@/lib/tauri/media";

const mocks = vi.hoisted(() => ({
  checkMediaCapabilities: vi.fn(),
  chooseSource: vi.fn(),
  inspectMedia: vi.fn(),
  activateSourcePath: vi.fn(),
  prepareAudioPreviews: vi.fn(),
  prepareProxyPreview: vi.fn(),
  prepareSourcePreview: vi.fn(),
  prepareWaveforms: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tauri/media")>();
  return {
    ...original,
    checkMediaCapabilities: mocks.checkMediaCapabilities,
    chooseSource: mocks.chooseSource,
    inspectMedia: mocks.inspectMedia,
    activateSourcePath: mocks.activateSourcePath,
    prepareAudioPreviews: mocks.prepareAudioPreviews,
    prepareProxyPreview: mocks.prepareProxyPreview,
    prepareSourcePreview: mocks.prepareSourcePreview,
    prepareWaveforms: mocks.prepareWaveforms,
  };
});

const firstSource: SourceRef = {
  displayName: "first.mp4",
  sourcePath: "C:/Media/first.mp4",
};

const secondSource: SourceRef = {
  displayName: "second.mp4",
  sourcePath: "C:/Media/second.mp4",
};

const thirdSource: SourceRef = {
  displayName: "third.mp4",
  sourcePath: "C:/Media/third.mp4",
};

function createMedia(_sourcePath: string, audioCount = 2): MediaInfo {
  return {
    formatName: "matroska,webm",
    durationMicros: 5_000_000,
    video: {
      streamIndex: 0,
      codecName: "h264",
      width: 1920,
      height: 1080,
    },
    audioStreams: Array.from({ length: audioCount }, (_, index) => ({
      streamIndex: index + 1,
      codecName: "aac",
      channels: 2,
      channelLayout: "stereo",
      sampleRateHz: 48_000,
      isDefault: index === 0,
    })),
    chapters: [],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

const ingestAndActivateSource =
  (source: SourceRef) => async (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(ingestSources([source]));
    const itemId = selectimportQueueItems(getState()).at(-1)?.id;
    await vi.waitFor(() => {
      if (selectActiveItemId(getState()) !== itemId) return;
      expect(["ready", "failed"]).toContain(selectSourceStatus(getState()));
    });
  };

function sourcePreview(_sourcePath: string, kind: "source" | "proxy" = "source") {
  return { mediaToken: 1, kind, url: `media://source/${kind}` };
}

function audioPreview(_sourcePath: string, streamIndex: number) {
  return { mediaToken: 1, streamIndex, url: `media://source/audio/${streamIndex}` };
}

function createHistoryItem(snapshot: EditorSnapshot, id = "history-1"): ExportQueueItem {
  return {
    id,
    snapshot,
    route: "fast",
    request: {
      sourcePath: snapshot.source.sourcePath,
      trim: "kind" in snapshot.trim ? { startMicros: 0, endMicros: 1_000_000 } : snapshot.trim,
      audioTracks: [],
      mergeAudio: false,
    },
    outputId: `output-${id}`,
    filename: `${id}.mp4`,
    path: `C:/Media/${id}.mp4`,
    status: "completed",
    operationId: `operation-${id}`,
    startedAt: 1,
    durationMs: 1,
    progressPercent: 100,
  };
}

describe("source/media orchestration thunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chooseSource.mockResolvedValue([]);
    mocks.checkMediaCapabilities.mockResolvedValue({
      ffmpeg: { available: true, version: "ffmpeg" },
      ffprobe: { available: true, version: "ffprobe" },
    });
    mocks.activateSourcePath.mockImplementation(async (sourcePath: string) => {
      const source = [firstSource, secondSource, thirdSource].find(
        (candidate) => candidate.sourcePath === sourcePath,
      );

      return source ?? { displayName: sourcePath, sourcePath };
    });
    mocks.prepareSourcePreview.mockImplementation(async (sourcePath: string) =>
      sourcePreview(sourcePath),
    );
    mocks.prepareProxyPreview.mockImplementation(async (sourcePath: string) =>
      sourcePreview(sourcePath, "proxy"),
    );
    mocks.prepareAudioPreviews.mockImplementation(async (sourcePath: string, indexes: number[]) =>
      indexes.map((streamIndex) => audioPreview(sourcePath, streamIndex)),
    );
    mocks.prepareWaveforms.mockImplementation(
      async (_sourcePath: string, jobId: string, indexes: number[], width: number) =>
        indexes.map((streamIndex): WaveformResult => ({
          status: "ready",
          jobId,
          streamIndex,
          width,
          url: `media://source/waveform/${streamIndex}/${width}`,
        })),
    );
  });

  it("coordinates inspect, source preview, and multiple audio previews", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 2));

    await appStore.dispatch(ingestAndActivateSource(firstSource));

    const state = appStore.getState();
    expect(selectSourceMedia(state)).toEqual(
      expect.objectContaining({ formatName: "matroska,webm" }),
    );
    expect(selectPreview(state)).toMatchObject({ status: "ready" });
    expect(selectAudioPreviews(state)).toMatchObject({
      status: "ready",
      previews: [audioPreview(firstSource.sourcePath, 1), audioPreview(firstSource.sourcePath, 2)],
    });
    expect(mocks.prepareAudioPreviews).toHaveBeenCalledWith(firstSource.sourcePath, [1, 2]);
    expect(selectimportQueueItems(appStore.getState())).toHaveLength(1);
    expect(selectimportQueueItems(appStore.getState())[0]?.origin).toBe("source-import");
    expect(selectActiveItemId(appStore.getState())).toBe(
      selectimportQueueItems(appStore.getState())[0]?.id,
    );
  });

  it("keeps distinct import queue items for repeated paths and restores drafts by id", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    const firstItem = selectimportQueueItems(appStore.getState())[0];
    expect(firstItem).toBeDefined();
    appStore.dispatch(
      trimChanged({
        trim: { startMicros: 500_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    const importedItems = selectimportQueueItems(appStore.getState());
    expect(importedItems).toHaveLength(2);
    expect(new Set(importedItems.map((item) => item.id)).size).toBe(2);
    expect(importedItems.every((item) => item.origin === "source-import")).toBe(true);
    expect(importedItems[0]?.snapshot.trim).toEqual({ startMicros: 500_000, endMicros: 4_000_000 });
    expect(importedItems[0]?.snapshot.source.sourcePath).toBe(firstSource.sourcePath);
    expect(selectActiveItemId(appStore.getState())).toBe(importedItems[1]?.id);

    expect(appStore.dispatch(navigateToImportedItem(firstItem!.id))).toBe(true);
    expect(selectActiveItemId(appStore.getState())).toBe(firstItem!.id);
    expect(selectSourceSelection(appStore.getState())).toBeNull();
    expect(selectSourceMedia(appStore.getState())).toBeNull();
    expect(selectPreview(appStore.getState())).toEqual({ status: "idle" });
    expect(selectAudioTracks(appStore.getState())).toEqual([]);
    await vi.waitFor(() => expect(selectSourceSelection(appStore.getState())).toEqual(firstSource));
    expect(selectActiveItemId(appStore.getState())).toBe(firstItem!.id);
    expect(appStore.getState().trim.value).toMatchObject({
      startMicros: 500_000,
      endMicros: 4_000_000,
    });
  });

  it("reactivates persisted sources while navigating without creating queue items", async () => {
    const appStore = createAppStore();
    let registeredSourcePath: string | null = null;
    const sourceForPath = (sourcePath: string) => {
      const source = [firstSource, secondSource, thirdSource].find(
        (candidate) => candidate.sourcePath === sourcePath,
      );

      return source ?? { displayName: sourcePath, sourcePath };
    };

    mocks.activateSourcePath.mockImplementation(async (sourcePath: string) => {
      registeredSourcePath = sourcePath;
      return sourceForPath(sourcePath);
    });
    mocks.inspectMedia.mockImplementation(async (sourcePath: string) => {
      if (registeredSourcePath !== null && registeredSourcePath !== sourcePath) {
        throw { code: "source_replaced", message: "The source is no longer active." };
      }
      registeredSourcePath = sourcePath;
      return createMedia(sourcePath, 2);
    });
    const savedCrop = { x: 0.1, y: 0.2, width: 0.7, height: 0.6 };

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    appStore.dispatch(
      trimChanged({
        trim: { startMicros: 500_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    appStore.dispatch(cropChanged({ crop: savedCrop, resolution: { width: 1920, height: 1080 } }));
    appStore.dispatch(masterVolumeChanged({ volumePercent: 25 }));
    appStore.dispatch(audioTrackVolumeChanged({ streamIndex: 1, volumePercent: 30 }));
    appStore.dispatch(audioTrackToggled({ streamIndex: 2 }));
    appStore.dispatch(audioMergeToggled());

    registeredSourcePath = secondSource.sourcePath;
    await appStore.dispatch(ingestAndActivateSource(secondSource));
    const afterSecondImport = selectimportQueueItems(appStore.getState());
    const [firstItem, secondItem] = afterSecondImport;
    const idsAfterSecondImport = afterSecondImport.map((item) => item.id);

    expect(appStore.dispatch(navigateToImportedItem(firstItem!.id))).toBe(true);
    await vi.waitFor(() => expect(selectSourceSelection(appStore.getState())).toEqual(firstSource));

    expect(mocks.activateSourcePath).toHaveBeenCalledWith(firstSource.sourcePath);
    expect(selectSourceError(appStore.getState())).toBeNull();
    expect(selectActiveItemId(appStore.getState())).toBe(firstItem!.id);
    expect(selectimportQueueItems(appStore.getState()).map((item) => item.id)).toEqual(
      idsAfterSecondImport,
    );
    expect(appStore.getState().trim.value).toMatchObject({
      startMicros: 500_000,
      endMicros: 4_000_000,
    });
    expect(selectCrop(appStore.getState())).toEqual(savedCrop);
    expect(selectMasterAudio(appStore.getState())).toEqual({ enabled: true, volumePercent: 25 });
    expect(selectAudioTracks(appStore.getState())).toMatchObject([
      expect.objectContaining({ streamIndex: 1, enabled: true, volumePercent: 30 }),
      expect.objectContaining({ streamIndex: 2, enabled: false, volumePercent: 50 }),
    ]);
    expect(selectMergeAudio(appStore.getState())).toBe(true);

    expect(appStore.dispatch(navigateToImportedItem(secondItem!.id))).toBe(true);
    await vi.waitFor(() =>
      expect(selectSourceSelection(appStore.getState())).toEqual(secondSource),
    );
    expect(mocks.activateSourcePath).toHaveBeenCalledWith(secondSource.sourcePath);
    expect(selectActiveItemId(appStore.getState())).toBe(secondItem!.id);
    expect(selectimportQueueItems(appStore.getState()).map((item) => item.id)).toEqual(
      idsAfterSecondImport,
    );

    registeredSourcePath = thirdSource.sourcePath;
    await appStore.dispatch(ingestAndActivateSource(thirdSource));
    const afterThirdImport = selectimportQueueItems(appStore.getState());
    const idsAfterThirdImport = afterThirdImport.map((item) => item.id);
    const thirdItem = afterThirdImport[2];

    expect(appStore.dispatch(navigateToImportedItem(secondItem!.id))).toBe(true);
    expect(appStore.dispatch(navigateToImportedItem(firstItem!.id))).toBe(true);
    await vi.waitFor(() => expect(selectSourceSelection(appStore.getState())).toEqual(firstSource));

    expect(selectActiveItemId(appStore.getState())).toBe(firstItem!.id);
    expect(selectimportQueueItems(appStore.getState()).map((item) => item.id)).toEqual(
      idsAfterThirdImport,
    );
    expect(thirdItem?.id).toBe(idsAfterThirdImport[2]);
  });

  it("keeps the selected target active when reactivation fails inspection", async () => {
    const appStore = createAppStore();
    let failSecondInspection = false;
    mocks.inspectMedia.mockImplementation(async (sourcePath: string) => {
      if (failSecondInspection && sourcePath === secondSource.sourcePath) {
        throw {
          code: "unsupported_media",
          message: "B could not be inspected.",
        };
      }
      return createMedia(sourcePath, 2);
    });
    const savedCrop = { x: 0.1, y: 0.2, width: 0.7, height: 0.6 };

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    appStore.dispatch(
      trimChanged({
        trim: { startMicros: 500_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    appStore.dispatch(cropChanged({ crop: savedCrop, resolution: { width: 1920, height: 1080 } }));
    appStore.dispatch(masterVolumeChanged({ volumePercent: 25 }));
    appStore.dispatch(audioTrackVolumeChanged({ streamIndex: 1, volumePercent: 30 }));
    appStore.dispatch(audioTrackToggled({ streamIndex: 2 }));
    appStore.dispatch(audioMergeToggled());

    await appStore.dispatch(ingestAndActivateSource(secondSource));
    const importedItems = selectimportQueueItems(appStore.getState());
    const [firstItem, secondItem] = importedItems;
    const queueIds = importedItems.map((item) => item.id);
    expect(appStore.dispatch(navigateToImportedItem(firstItem!.id))).toBe(true);
    await vi.waitFor(() => expect(selectSourceSelection(appStore.getState())).toEqual(firstSource));

    failSecondInspection = true;
    expect(appStore.dispatch(navigateToImportedItem(secondItem!.id))).toBe(true);
    await vi.waitFor(() =>
      expect(selectSourceError(appStore.getState())).toEqual({
        code: "unsupported_media",
        message: "B could not be inspected.",
      }),
    );

    expect(selectActiveItemId(appStore.getState())).toBe(secondItem!.id);
    expect(selectSourceSelection(appStore.getState())).toEqual(secondSource);
    expect(selectSourceMedia(appStore.getState())).toBeNull();
    expect(selectSourceError(appStore.getState())).toEqual({
      code: "unsupported_media",
      message: "B could not be inspected.",
    });
    expect(appStore.getState().trim.value).toBeNull();
    expect(selectCrop(appStore.getState())).not.toEqual(savedCrop);
    expect(selectMasterAudio(appStore.getState())).toEqual({ enabled: true, volumePercent: 50 });
    expect(selectAudioTracks(appStore.getState())).toEqual([]);
    expect(selectMergeAudio(appStore.getState())).toBe(false);
    expect(selectimportQueueItems(appStore.getState()).map((item) => item.id)).toEqual(queueIds);
    expect(mocks.activateSourcePath).toHaveBeenCalledWith(secondSource.sourcePath);
    expect(mocks.activateSourcePath).not.toHaveBeenLastCalledWith(firstSource.sourcePath);
  });

  it("captures source-import drafts and preserves them when leaving the active item", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    const importedItem = selectimportQueueItems(appStore.getState())[0];
    expect(importedItem?.origin).toBe("source-import");
    appStore.dispatch(
      trimChanged({
        trim: { startMicros: 750_000, endMicros: 3_500_000, sourceDurationMicros: 5_000_000 },
      }),
    );

    await appStore.dispatch(leaveActiveImportedItem());

    expect(selectimportQueueItems(appStore.getState())).toHaveLength(1);
    expect(selectimportQueueItems(appStore.getState())[0]?.snapshot.trim).toEqual({
      startMicros: 750_000,
      endMicros: 3_500_000,
    });
    expect(selectActiveItemId(appStore.getState())).toBe(importedItem?.id);
  });

  it("keeps a source-import active when a replacement source fails to load", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValueOnce(createMedia(firstSource.sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    const firstItem = selectimportQueueItems(appStore.getState())[0];
    appStore.dispatch(
      trimChanged({
        trim: { startMicros: 750_000, endMicros: 3_500_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    mocks.inspectMedia.mockRejectedValueOnce({
      code: "unsupported_media",
      message: "The replacement source is not supported.",
    });

    await appStore.dispatch(ingestAndActivateSource(secondSource));

    expect(selectimportQueueItems(appStore.getState())).toEqual([
      expect.objectContaining({
        id: firstItem?.id,
        snapshot: expect.objectContaining({
          trim: { startMicros: 750_000, endMicros: 3_500_000 },
        }),
      }),
      expect.objectContaining({
        snapshot: expect.objectContaining({ source: secondSource }),
      }),
    ]);
    expect(selectActiveItemId(appStore.getState())).not.toBe(firstItem?.id);
  });

  it("discards a history fork when navigating to another imported item", async () => {
    const appStore = createAppStore();
    const snapshot = {
      source: firstSource,
      trim: { startMicros: 0, endMicros: 5_000_000 },
      crop: null,
      audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
    };

    const fork = {
      id: "fork-1",
      status: "imported" as const,
      origin: "history-fork" as const,
      snapshot,
    };

    const target = {
      id: "import-2",
      status: "imported" as const,
      origin: "source-import" as const,
      snapshot: { ...snapshot, source: secondSource },
    };

    appStore.dispatch(importQueueItemAdded(fork));
    appStore.dispatch(importQueueItemAdded(target));
    appStore.dispatch(activeQueueItemChanged(fork.id));
    mocks.inspectMedia.mockResolvedValue(createMedia(secondSource.sourcePath, 1));

    expect(appStore.dispatch(navigateToImportedItem(target.id))).toBe(true);
    await vi.waitFor(() =>
      expect(selectSourceSelection(appStore.getState())).toEqual(secondSource),
    );

    expect(selectimportQueueItems(appStore.getState())).toEqual([target]);
    expect(selectActiveItemId(appStore.getState())).toBe(target.id);
  });

  it("removes only the active imported item and restores the next item", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockImplementation(async (sourcePath: string) => createMedia(sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    await appStore.dispatch(ingestAndActivateSource(secondSource));
    await appStore.dispatch(ingestAndActivateSource(thirdSource));
    const [firstItem, secondItem, thirdItem] = selectimportQueueItems(appStore.getState());
    expect(appStore.dispatch(navigateToImportedItem(secondItem!.id))).toBe(true);
    await vi.waitFor(() =>
      expect(selectSourceSelection(appStore.getState())).toEqual(secondSource),
    );

    await appStore.dispatch(closeActiveImportedItemRequested());

    expect(selectimportQueueItems(appStore.getState()).map((item) => item.id)).toEqual([
      firstItem!.id,
      thirdItem!.id,
    ]);
    expect(selectActiveItemId(appStore.getState())).toBe(thirdItem!.id);
    await vi.waitFor(() => expect(selectSourceSelection(appStore.getState())).toEqual(thirdSource));
  });

  it("chooses the previous imported item when closing the last item", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockImplementation(async (sourcePath: string) => createMedia(sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    await appStore.dispatch(ingestAndActivateSource(secondSource));
    const [firstItem, secondItem] = selectimportQueueItems(appStore.getState());
    expect(selectActiveItemId(appStore.getState())).toBe(secondItem!.id);

    await appStore.dispatch(closeActiveImportedItemRequested());
    await vi.waitFor(() => expect(selectSourceSelection(appStore.getState())).toEqual(firstSource));

    expect(selectimportQueueItems(appStore.getState()).map((item) => item.id)).toEqual([
      firstItem!.id,
    ]);
    expect(selectActiveItemId(appStore.getState())).toBe(firstItem!.id);
  });

  it("removes the last imported item and clears the editor", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    await appStore.dispatch(closeActiveImportedItemRequested());

    expect(selectimportQueueItems(appStore.getState())).toEqual([]);
    expect(selectActiveItemId(appStore.getState())).toBeNull();
    expect(selectHasSource(appStore.getState())).toBe(false);
  });

  it("removes an imported item without changing export history", async () => {
    const appStore = createAppStore();
    const snapshot: EditorSnapshot = {
      source: firstSource,
      trim: { startMicros: 0, endMicros: 5_000_000 },
      crop: null,
      audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
    };

    const importedItem = {
      id: "import-1",
      status: "imported" as const,
      origin: "source-import" as const,
      snapshot,
    };

    const historyItem = createHistoryItem(snapshot);
    appStore.dispatch(sourceSelected({ source: firstSource }));
    appStore.dispatch(sourceReady({ loadToken: 1, media: createMedia(firstSource.sourcePath, 1) }));
    appStore.dispatch(queueEntryAdded(historyItem));
    appStore.dispatch(importQueueItemAdded(importedItem));

    await appStore.dispatch(closeActiveImportedItemRequested());

    expect(selectimportQueueItems(appStore.getState())).toEqual([]);
    expect(selectExportQueue(appStore.getState())).toEqual([historyItem]);
  });

  it("discards a history fork without changing its original export history", async () => {
    const appStore = createAppStore();
    const snapshot: EditorSnapshot = {
      source: firstSource,
      trim: { startMicros: 0, endMicros: 5_000_000 },
      crop: null,
      audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
    };

    const historyItem = createHistoryItem(snapshot);
    const fork = {
      id: "fork-1",
      status: "imported" as const,
      origin: "history-fork" as const,
      snapshot,
    };

    appStore.dispatch(sourceSelected({ source: firstSource }));
    appStore.dispatch(sourceReady({ loadToken: 1, media: createMedia(firstSource.sourcePath, 1) }));
    appStore.dispatch(queueEntryAdded(historyItem));
    appStore.dispatch(importQueueItemAdded(fork));

    await appStore.dispatch(closeActiveImportedItemRequested());

    expect(selectimportQueueItems(appStore.getState())).toEqual([]);
    expect(selectExportQueue(appStore.getState())).toEqual([historyItem]);
    expect(selectHasSource(appStore.getState())).toBe(false);
  });

  it("keeps a failed target active and allows navigation afterward", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValueOnce(createMedia(firstSource.sourcePath, 1));
    await appStore.dispatch(ingestAndActivateSource(firstSource));
    const sourceItem = selectimportQueueItems(appStore.getState())[0];
    const target = {
      id: "import-2",
      status: "imported" as const,
      origin: "source-import" as const,
      snapshot: {
        source: secondSource,
        trim: { startMicros: 0, endMicros: 5_000_000 },
        crop: null,
        audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
      },
    };

    appStore.dispatch(importQueueItemAdded(target));
    appStore.dispatch(activeQueueItemChanged(sourceItem!.id));
    mocks.activateSourcePath.mockRejectedValueOnce({
      code: "io_failed",
      message: "The target source could not be reopened.",
    });

    expect(appStore.dispatch(navigateToImportedItem(target.id))).toBe(true);
    await vi.waitFor(() =>
      expect(selectSourceError(appStore.getState())).toEqual({
        code: "io_failed",
        message: "The target source could not be reopened.",
      }),
    );

    expect(selectimportQueueItems(appStore.getState())).toEqual([
      expect.objectContaining({ id: sourceItem?.id }),
      target,
    ]);
    expect(selectActiveItemId(appStore.getState())).toBe(target.id);
    expect(selectSourceError(appStore.getState())).toEqual({
      code: "io_failed",
      message: "The target source could not be reopened.",
    });

    expect(appStore.dispatch(navigateToImportedItem(sourceItem!.id))).toBe(true);
    await vi.waitFor(() => expect(selectSourceSelection(appStore.getState())).toEqual(firstSource));
    expect(selectActiveItemId(appStore.getState())).toBe(sourceItem!.id);
  });

  it("keeps a missing automatic close replacement active", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockImplementation(async (sourcePath: string) => createMedia(sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    await appStore.dispatch(ingestAndActivateSource(secondSource));
    await appStore.dispatch(ingestAndActivateSource(thirdSource));
    const [firstItem, secondItem, thirdItem] = selectimportQueueItems(appStore.getState());
    expect(appStore.dispatch(navigateToImportedItem(secondItem!.id))).toBe(true);
    await vi.waitFor(() =>
      expect(selectSourceSelection(appStore.getState())).toEqual(secondSource),
    );

    mocks.activateSourcePath.mockRejectedValueOnce({
      code: "io_failed",
      message: "The next source is missing.",
    });
    await appStore.dispatch(closeActiveImportedItemRequested());
    await vi.waitFor(() =>
      expect(selectSourceError(appStore.getState())).toEqual({
        code: "io_failed",
        message: "The next source is missing.",
      }),
    );

    expect(selectimportQueueItems(appStore.getState()).map((item) => item.id)).toEqual([
      firstItem!.id,
      thirdItem!.id,
    ]);
    expect(selectActiveItemId(appStore.getState())).toBe(thirdItem!.id);
    expect(selectSourceSelection(appStore.getState())).toBeNull();
  });

  it("discards a history fork when a new source is imported", async () => {
    const appStore = createAppStore();
    const historyFork = {
      id: "fork-1",
      status: "imported" as const,
      origin: "history-fork" as const,
      snapshot: {
        source: firstSource,
        trim: { startMicros: 0, endMicros: 5_000_000 },
        crop: null,
        audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
      },
    };

    appStore.dispatch(importQueueItemAdded(historyFork));
    mocks.inspectMedia.mockResolvedValue(createMedia(secondSource.sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(secondSource));

    expect(
      selectimportQueueItems(appStore.getState()).every((item) => item.origin === "source-import"),
    ).toBe(true);
    expect(selectimportQueueItems(appStore.getState())).not.toContainEqual(historyFork);
    expect(selectActiveItemId(appStore.getState())).toBe(
      selectimportQueueItems(appStore.getState())[0]?.id,
    );
  });

  it("clears native chooser state before a selected source finishes importing", async () => {
    const appStore = createAppStore();
    const picker = createDeferred<SourceRef[]>();
    const inspection = createDeferred<MediaInfo>();
    mocks.chooseSource.mockReturnValue(picker.promise);
    mocks.inspectMedia.mockReturnValue(inspection.promise);

    const chooserRequest = appStore.dispatch(chooseSourceRequested());
    expect(selectIsChoosingSource(appStore.getState())).toBe(true);
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(true);

    picker.resolve([firstSource]);
    await vi.waitFor(() => {
      expect(selectIsChoosingSource(appStore.getState())).toBe(false);
      expect(selectIsNativeDialogOpen(appStore.getState())).toBe(false);
    });
    expect(selectSourceStatus(appStore.getState())).toBe("loading-source");
    expect(mocks.inspectMedia).toHaveBeenCalledWith(firstSource.sourcePath);

    inspection.resolve(createMedia(firstSource.sourcePath, 1));
    await chooserRequest;
    expect(selectSourceStatus(appStore.getState())).toBe("ready");
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(false);
  });

  it("clears native chooser state when the picker is cancelled", async () => {
    const appStore = createAppStore();
    const picker = createDeferred<SourceRef[]>();
    mocks.chooseSource.mockReturnValue(picker.promise);

    const chooserRequest = appStore.dispatch(chooseSourceRequested());
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(true);
    picker.resolve([]);
    await chooserRequest;

    expect(selectIsChoosingSource(appStore.getState())).toBe(false);
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(false);
    expect(selectHasSource(appStore.getState())).toBe(false);
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });

  it("clears native chooser state and preserves normalized picker errors", async () => {
    const appStore = createAppStore();
    const picker = createDeferred<SourceRef[]>();
    mocks.chooseSource.mockReturnValue(picker.promise);

    const chooserRequest = appStore.dispatch(chooseSourceRequested());
    picker.reject({ code: "dialog_failed", message: "The source picker failed." });
    await chooserRequest;

    expect(selectIsChoosingSource(appStore.getState())).toBe(false);
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(false);
    expect(selectSourceError(appStore.getState())).toEqual({
      code: "dialog_failed",
      message: "The source picker failed.",
    });
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });

  it("marks single-stream audio preparation ready without invoking a native job", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));

    await appStore.dispatch(ingestAndActivateSource(firstSource));

    expect(selectAudioPreviews(appStore.getState())).toMatchObject({
      status: "ready",
      previews: [],
    });
    expect(mocks.prepareAudioPreviews).not.toHaveBeenCalled();
  });

  it("ignores stale inspection results when a newer source replaces them", async () => {
    const appStore = createAppStore();
    const firstInspection = createDeferred<MediaInfo>();
    const secondInspection = createDeferred<MediaInfo>();
    mocks.inspectMedia.mockImplementation((sourcePath: string) =>
      sourcePath === firstSource.sourcePath ? firstInspection.promise : secondInspection.promise,
    );

    const firstImport = appStore.dispatch(ingestAndActivateSource(firstSource));
    const secondImport = appStore.dispatch(ingestAndActivateSource(secondSource));
    secondInspection.resolve(createMedia(secondSource.sourcePath, 1));
    await secondImport;
    firstInspection.resolve(createMedia(firstSource.sourcePath, 2));
    await firstImport;

    expect(selectSourceSelection(appStore.getState())).toEqual(secondSource);
    expect(mocks.prepareSourcePreview).toHaveBeenCalledTimes(1);
    expect(mocks.prepareSourcePreview).toHaveBeenCalledWith(secondSource.sourcePath);
  });

  it("records inspection failures and capability failures as serializable app errors", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockRejectedValue({ code: "unsupported_media", message: "Not a video" });

    await appStore.dispatch(ingestAndActivateSource(firstSource));
    expect(selectSourceError(appStore.getState())).toEqual({
      code: "unsupported_media",
      message: "Not a video",
    });

    mocks.checkMediaCapabilities.mockRejectedValue(new Error("ffmpeg missing"));
    await appStore.dispatch(checkMediaCapabilitiesRequested());
    expect(selectCapabilities(appStore.getState())).toMatchObject({
      status: "failed",
      error: { code: "internal", message: "ffmpeg missing" },
    });
  });

  it("falls back from source preview playback to a proxy preview", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));
    await appStore.dispatch(ingestAndActivateSource(firstSource));

    await appStore.dispatch(handlePreviewPlaybackError(firstSource.sourcePath, "source"));

    expect(mocks.prepareProxyPreview).toHaveBeenCalledWith(firstSource.sourcePath);
    expect(selectPreview(appStore.getState())).toMatchObject({
      status: "ready",
      value: sourcePreview(firstSource.sourcePath, "proxy"),
    });
  });

  it("marks proxy playback failure as the final preview failure", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));
    await appStore.dispatch(ingestAndActivateSource(firstSource));
    mocks.prepareProxyPreview.mockRejectedValue({
      code: "unsupported_media",
      message: "No compatible preview could be created",
    });

    await appStore.dispatch(handlePreviewPlaybackError(firstSource.sourcePath, "source"));
    await appStore.dispatch(handlePreviewPlaybackError(firstSource.sourcePath, "proxy"));

    expect(selectPreview(appStore.getState())).toMatchObject({
      status: "failed",
      error: { code: "preview_playback_failed" },
    });
  });

  it("keeps audio previews unavailable when preparation fails", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 2));
    mocks.prepareAudioPreviews.mockRejectedValue({
      code: "io_failed",
      message: "Audio preview failed",
    });

    await appStore.dispatch(ingestAndActivateSource(firstSource));

    expect(selectAudioPreviews(appStore.getState())).toMatchObject({
      status: "unavailable",
      error: { code: "io_failed", message: "Audio preview failed" },
    });
  });

  it("keeps only the newest waveform job result", async () => {
    const appStore = createAppStore();
    const sourceMedia = createMedia(firstSource.sourcePath, 2);
    mocks.inspectMedia.mockResolvedValue(sourceMedia);
    await appStore.dispatch(ingestAndActivateSource(firstSource));

    const jobs = new Map<string, ReturnType<typeof createDeferred<WaveformResult[]>>>();
    mocks.prepareWaveforms.mockImplementation((_sourcePath: string, jobId: string) => {
      const deferred = createDeferred<WaveformResult[]>();
      jobs.set(jobId, deferred);
      return deferred.promise;
    });

    const firstJob = appStore.dispatch(prepareSourceWaveforms(firstSource.sourcePath, [1, 2], 800));
    await vi.waitFor(() => expect(jobs.size).toBe(1));
    const firstJobId = [...jobs.keys()][0] as string;
    const secondJob = appStore.dispatch(
      prepareSourceWaveforms(firstSource.sourcePath, [1, 2], 1200),
    );

    await vi.waitFor(() => expect(jobs.size).toBe(2));
    const secondJobId = [...jobs.keys()][1] as string;

    jobs.get(secondJobId)?.resolve([
      {
        status: "ready",
        jobId: secondJobId,
        streamIndex: 1,
        width: 1200,
        url: "media://new-waveform",
      },
    ]);
    jobs.get(firstJobId)?.resolve([
      {
        status: "ready",
        jobId: firstJobId,
        streamIndex: 1,
        width: 800,
        url: "media://stale-waveform",
      },
    ]);
    await Promise.all([firstJob, secondJob]);

    const track = selectAudioTracks(appStore.getState()).find(
      (candidate) => candidate.streamIndex === 1,
    );

    expect(track?.waveform).toMatchObject({
      status: "ready",
      jobId: secondJobId,
      width: 1200,
      url: "media://new-waveform",
    });
  });

  it("records waveform preparation failure and clears the source on close", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));
    await appStore.dispatch(ingestAndActivateSource(firstSource));
    mocks.prepareWaveforms.mockRejectedValue({
      code: "waveform_failed",
      message: "Waveform generation failed",
    });

    await appStore.dispatch(prepareSourceWaveforms(firstSource.sourcePath, [1], 800));
    const waveform = selectAudioTracks(appStore.getState())[0]?.waveform;
    expect(waveform).toMatchObject({
      status: "failed",
      error: { code: "waveform_failed", message: "Waveform generation failed" },
    });

    appStore.dispatch(closeActiveImportedItemRequested());
    expect(selectHasSource(appStore.getState())).toBe(false);
    expect(selectAudioPreviews(appStore.getState())).toBeNull();
  });
});
