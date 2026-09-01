import { beforeEach, describe, expect, it, vi } from "vitest";

import { startSourceMediaRuntime } from "@/app/store/integration/source-media-runtime";
import { selectImportQueueItems } from "@/app/store/slices/export-slice";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { createAppStore } from "@/app/store/store";
import type { SourceRef } from "@/domain/source";
import { getCurrentSessionDiagnosticsSnapshot } from "@/lib/diagnostics";
import type { MediaInfo, SourceDropEvent, SourceImportResult } from "@/lib/tauri/media.types";

const mocks = vi.hoisted(() => ({
  checkMediaCapabilities: vi.fn(),
  activateSourcePath: vi.fn(),
  inspectMedia: vi.fn(),
  listenForSourceDrops: vi.fn(),
  prepareAudioPreviews: vi.fn(),
  prepareSourcePreview: vi.fn(),
  unlisten: vi.fn(),
}));

vi.mock("@/lib/tauri/media", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/tauri/media")>();
  return {
    ...original,
    checkMediaCapabilities: mocks.checkMediaCapabilities,
    activateSourcePath: mocks.activateSourcePath,
    inspectMedia: mocks.inspectMedia,
    listenForSourceDrops: mocks.listenForSourceDrops,
    prepareAudioPreviews: mocks.prepareAudioPreviews,
    prepareSourcePreview: mocks.prepareSourcePreview,
  };
});

const source: SourceRef = {
  displayName: "runtime.mp4",
  sourcePath: "C:/Media/runtime.mp4",
};

const secondSource: SourceRef = {
  displayName: "second.mp4",
  sourcePath: "C:/Media/second.mp4",
};

const media: MediaInfo = {
  formatName: "mp4",
  durationMicros: 1_000_000,
  video: { streamIndex: 0, codecName: "h264", width: 1280, height: 720 },
  audioStreams: [],
  chapters: [],
};

describe("source/media application runtime", () => {
  let sourceDropListener: ((event: SourceDropEvent) => void) | undefined;
  let importRequested: (() => string) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    sourceDropListener = undefined;
    importRequested = undefined;
    mocks.checkMediaCapabilities.mockResolvedValue({
      ffmpeg: { available: true, version: "ffmpeg" },
      ffprobe: { available: true, version: "ffprobe" },
    });
    mocks.activateSourcePath.mockResolvedValue(source);
    mocks.inspectMedia.mockResolvedValue(media);
    mocks.prepareSourcePreview.mockResolvedValue({
      mediaToken: 1,
      kind: "source",
      url: "media://runtime/source",
    });
    mocks.prepareAudioPreviews.mockResolvedValue([]);
    mocks.listenForSourceDrops.mockImplementation(
      async (listener: (event: SourceDropEvent) => void, onImportRequested?: () => string) => {
        sourceDropListener = listener;
        importRequested = onImportRequested;
        return mocks.unlisten;
      },
    );
  });

  it("correlates a dropped recursive import as one operation with drop origin", async () => {
    const appStore = createAppStore();
    const importResult: SourceImportResult = {
      acceptedFileCount: 2,
      directFileCount: 0,
      discoveredFileCount: 2,
      folderCount: 1,
      readErrorCount: 0,
      recursive: true,
      skippedFileCount: 0,
      sources: [source, secondSource],
      truncated: false,
    };

    startSourceMediaRuntime(appStore.dispatch);
    await vi.waitFor(() => expect(sourceDropListener).toBeDefined());

    const operationId = importRequested?.();
    expect(operationId).toBeDefined();
    sourceDropListener?.({ operationId, importResult, status: "selected" });

    await vi.waitFor(() => expect(selectImportQueueItems(appStore.getState())).toHaveLength(2));
    const events = getCurrentSessionDiagnosticsSnapshot().events;
    const started = [...events]
      .reverse()
      .find(
        (event) => event.operationId === operationId && event.event === "source.import.started",
      );

    expect(started).toMatchObject({
      event: "source.import.started",
      origin: { id: "source.drop", type: "button" },
    });
    expect(
      events.filter(
        (event) => event.operationId === operationId && event.event === "source.import.completed",
      ),
    ).toHaveLength(1);
  });

  it("registers once, preserves drag/drop events, converges selected files, and cleans up once", async () => {
    const appStore = createAppStore();
    const stop = startSourceMediaRuntime(appStore.dispatch);
    await vi.waitFor(() => expect(sourceDropListener).toBeDefined());

    expect(mocks.listenForSourceDrops).toHaveBeenCalledOnce();
    sourceDropListener?.({ status: "drag", active: true });
    expect(selectIsSourceDragActive(appStore.getState())).toBe(true);
    expect(appStore.getState().importWorkflow.isNativeDialogOpen).toBe(false);

    sourceDropListener?.({ status: "selected", sources: [source, secondSource] });
    await vi.waitFor(() => expect(selectSourceMedia(appStore.getState())).toEqual(media));
    expect(mocks.inspectMedia).toHaveBeenCalledWith(source.sourcePath);
    expect(mocks.inspectMedia).toHaveBeenCalledTimes(2);
    expect(selectImportQueueItems(appStore.getState())).toHaveLength(2);
    expect(selectImportQueueItems(appStore.getState())[0]?.origin).toBe("source-import");

    stop();
    stop();
    expect(mocks.unlisten).toHaveBeenCalledOnce();
  });

  it("reports listener failures and ignores events after cleanup", async () => {
    const appStore = createAppStore();
    const stop = startSourceMediaRuntime(appStore.dispatch);
    await vi.waitFor(() => expect(sourceDropListener).toBeDefined());
    sourceDropListener?.({
      status: "failed",
      error: { code: "drop_listener_failed", message: "Drop listener failed" },
    });

    expect(appStore.getState().importWorkflow.dropListenerError).toEqual({
      code: "drop_listener_failed",
      message: "Drop listener failed",
    });
    expect(appStore.getState().source.error).toEqual({
      code: "drop_listener_failed",
      message: "Drop listener failed",
    });

    stop();
    sourceDropListener?.({ status: "selected", sources: [source] });
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });
});
