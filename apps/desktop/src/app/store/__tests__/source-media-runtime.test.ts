import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaInfo, SourceDropEvent } from "@/lib/tauri/media";
import type { SourceRef } from "@/domain/source";
import { createAppStore } from "@/app/store/store";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";
import { selectSourceMedia, selectSourceError } from "@/app/store/slices/source-slice";
import { selectImportedQueueItems } from "@/app/store/slices/export-slice";
import { startSourceMediaRuntime } from "@/app/store/source-media-runtime";

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

  beforeEach(() => {
    vi.clearAllMocks();
    sourceDropListener = undefined;
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
      async (listener: (event: SourceDropEvent) => void) => {
        sourceDropListener = listener;
        return mocks.unlisten;
      },
    );
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
    expect(mocks.inspectMedia).toHaveBeenCalledOnce();
    expect(selectImportedQueueItems(appStore.getState())).toHaveLength(2);
    expect(selectImportedQueueItems(appStore.getState())[0]?.origin).toBe("source-import");

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
    expect(selectSourceError(appStore.getState())).toEqual({
      code: "drop_listener_failed",
      message: "Drop listener failed",
    });

    stop();
    sourceDropListener?.({ status: "selected", sources: [source] });
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });
});
