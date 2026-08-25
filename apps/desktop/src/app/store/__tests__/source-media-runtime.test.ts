import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaInfo, SourceDropEvent, SourceSelection } from "@/lib/tauri/media";
import { createAppStore } from "@/app/store/store";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";
import { selectActiveSource } from "@/app/store/slices/session-slice";
import { startSourceMediaRuntime } from "@/app/store/source-media-runtime";

const mocks = vi.hoisted(() => ({
  checkMediaCapabilities: vi.fn(),
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
    inspectMedia: mocks.inspectMedia,
    listenForSourceDrops: mocks.listenForSourceDrops,
    prepareAudioPreviews: mocks.prepareAudioPreviews,
    prepareSourcePreview: mocks.prepareSourcePreview,
  };
});

const source: SourceSelection = { sourceId: "runtime-source", displayName: "runtime.mp4" };
const media: MediaInfo = {
  sourceId: source.sourceId,
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
    mocks.inspectMedia.mockResolvedValue(media);
    mocks.prepareSourcePreview.mockResolvedValue({
      sourceId: source.sourceId,
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

    sourceDropListener?.({ status: "selected", source });
    await vi.waitFor(() =>
      expect(selectActiveSource(appStore.getState())?.media?.sourceId).toBe(source.sourceId),
    );
    expect(mocks.inspectMedia).toHaveBeenCalledWith(source.sourceId);

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
    expect(appStore.getState().session.lastError).toEqual({
      code: "drop_listener_failed",
      message: "Drop listener failed",
    });

    stop();
    sourceDropListener?.({ status: "selected", source });
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });
});
