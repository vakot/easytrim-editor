import { beforeEach, describe, expect, it, vi } from "vitest";

import { selectAudioPreviews } from "@/app/store/slices/audio-slice";
import {
  importQueueItemAdded,
  selectActiveItemId,
  selectImportQueueItems,
} from "@/app/store/slices/export-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { createAppStore } from "@/app/store/store";
import { ingestSources, navigateToImportedItem } from "@/app/store/thunks/source-media-thunks";
import type { SourceRef } from "@/domain/source";
import type { MediaInfo } from "@/lib/tauri/media.types";

const mocks = vi.hoisted(() => ({
  activateSourcePath: vi.fn(),
  inspectMedia: vi.fn(),
  prepareAudioPreviews: vi.fn(),
  prepareSourcePreview: vi.fn(),
  prepareWaveforms: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tauri/media")>();
  return {
    ...original,
    activateSourcePath: mocks.activateSourcePath,
    inspectMedia: mocks.inspectMedia,
    prepareAudioPreviews: mocks.prepareAudioPreviews,
    prepareSourcePreview: mocks.prepareSourcePreview,
    prepareWaveforms: mocks.prepareWaveforms,
  };
});

const sourceA: SourceRef = { displayName: "A.mp4", sourcePath: "C:/Media/A.mp4" };
const sourceB: SourceRef = { displayName: "B.mp4", sourcePath: "C:/Media/B.mp4" };
const sourceC: SourceRef = { displayName: "C.mp4", sourcePath: "C:/Media/C.mp4" };

function createMedia(sourcePath: string): MediaInfo {
  void sourcePath;
  return {
    formatName: "mp4",
    durationMicros: 5_000_000,
    video: { streamIndex: 0, codecName: "h264", width: 1280, height: 720 },
    audioStreams: [
      { streamIndex: 1, codecName: "aac", channels: 2, isDefault: true },
      { streamIndex: 2, codecName: "aac", channels: 2, isDefault: false },
    ],
    chapters: [],
  };
}

async function waitForSourceReady(store: ReturnType<typeof createAppStore>) {
  await vi.waitFor(() => expect(store.getState().source.status).toBe("ready"));
}

describe("unified source ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activateSourcePath.mockImplementation(async (sourcePath: string) => {
      return [sourceA, sourceB, sourceC].find((source) => source.sourcePath === sourcePath);
    });
    mocks.inspectMedia.mockImplementation(async (sourcePath: string) => createMedia(sourcePath));
    mocks.prepareAudioPreviews.mockResolvedValue([]);
    mocks.prepareSourcePreview.mockResolvedValue({
      mediaToken: 1,
      kind: "source",
      url: "media://source",
    });
  });

  it("appends an ordered batch with unique lightweight snapshots and activates only its first item", async () => {
    const store = createAppStore();

    store.dispatch(ingestSources([sourceA, sourceB, sourceC]));
    const items = selectImportQueueItems(store.getState());

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.snapshot.source)).toEqual([sourceA, sourceB, sourceC]);
    expect(new Set(items.map((item) => item.id)).size).toBe(3);
    expect(items.map((item) => item.snapshot.trim)).toEqual([
      { kind: "full-source" },
      { kind: "full-source" },
      { kind: "full-source" },
    ]);

    await waitForSourceReady(store);
    expect(selectActiveItemId(store.getState())).toBe(items[0]?.id);
    expect(mocks.inspectMedia).toHaveBeenCalledTimes(1);
    expect(mocks.inspectMedia).toHaveBeenCalledWith(sourceA.sourcePath);
    expect(mocks.prepareSourcePreview).toHaveBeenCalledTimes(1);
    expect(mocks.prepareAudioPreviews).toHaveBeenCalledTimes(1);

    store.dispatch(navigateToImportedItem(items[1]!.id));
    await vi.waitFor(() => expect(mocks.inspectMedia).toHaveBeenCalledWith(sourceB.sourcePath));
    expect(mocks.inspectMedia).toHaveBeenCalledTimes(2);
  });

  it("keeps duplicate source paths as distinct imported items", () => {
    const store = createAppStore();

    store.dispatch(ingestSources([sourceA, sourceA]));

    const items = selectImportQueueItems(store.getState());
    expect(items).toHaveLength(2);
    expect(items[0]?.snapshot.source).toEqual(sourceA);
    expect(items[1]?.snapshot.source).toEqual(sourceA);
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });

  it("preserves existing items and captures the active draft before activating a new batch", async () => {
    const store = createAppStore();
    store.dispatch(ingestSources([sourceA, sourceB]));
    await waitForSourceReady(store);

    store.dispatch(
      trimChanged({
        trim: { startMicros: 1_000_000, endMicros: 3_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );
    store.dispatch(ingestSources([sourceC, sourceA]));

    const items = selectImportQueueItems(store.getState());
    expect(items.map((item) => item.snapshot.source.sourcePath)).toEqual([
      sourceA.sourcePath,
      sourceB.sourcePath,
      sourceC.sourcePath,
      sourceA.sourcePath,
    ]);
    expect(items[0]?.snapshot.trim).toEqual({ startMicros: 1_000_000, endMicros: 3_000_000 });
    expect(selectActiveItemId(store.getState())).toBe(items[2]?.id);
  });

  it("discards a history fork when the first item of a new batch is activated", async () => {
    const store = createAppStore();
    const fork = {
      id: "fork-1",
      status: "imported" as const,
      origin: "history-fork" as const,
      snapshot: {
        source: sourceA,
        trim: { startMicros: 0, endMicros: 5_000_000 },
        crop: null,
        audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
      },
    };

    store.dispatch(importQueueItemAdded(fork));
    store.dispatch(ingestSources([sourceB]));

    await waitForSourceReady(store);
    expect(selectImportQueueItems(store.getState()).map((item) => item.id)).not.toContain("fork-1");
  });

  it("keeps a failed later item active in the queue", async () => {
    const store = createAppStore();
    store.dispatch(ingestSources([sourceA, sourceB]));
    const items = selectImportQueueItems(store.getState());
    await waitForSourceReady(store);

    mocks.activateSourcePath.mockRejectedValueOnce({
      code: "io_failed",
      message: "B is no longer available.",
    });
    store.dispatch(navigateToImportedItem(items[1]!.id));

    await vi.waitFor(() =>
      expect(store.getState().source.error).toEqual({
        code: "io_failed",
        message: "B is no longer available.",
      }),
    );
    expect(selectActiveItemId(store.getState())).toBe(items[1]?.id);
    expect(selectImportQueueItems(store.getState())).toHaveLength(2);
    expect(selectAudioPreviews(store.getState())).toEqual({ status: "idle", previews: [] });
    expect(selectPreview(store.getState())).toEqual({
      status: "failed",
      error: { code: "io_failed", message: "B is no longer available." },
    });
    expect(mocks.inspectMedia).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an empty batch", () => {
    const store = createAppStore();

    store.dispatch(ingestSources([]));

    expect(selectImportQueueItems(store.getState())).toEqual([]);
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });
});
