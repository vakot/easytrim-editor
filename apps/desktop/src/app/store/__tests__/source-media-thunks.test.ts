import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaInfo, WaveformResult } from "@/lib/tauri/media";
import type { SourceRef } from "@/domain/source";
import { createAppStore } from "@/app/store/store";
import { selectAudioPreviews, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectActiveItemId, selectImportedQueueItems } from "@/app/store/slices/export-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import {
  selectHasSource,
  selectSourceError,
  selectSourceMedia,
  selectSourceSelection,
  selectSourceStatus,
  selectCapabilities,
} from "@/app/store/slices/source-slice";
import {
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import {
  checkMediaCapabilitiesRequested,
  chooseSourceRequested,
  closeSourceRequested,
  handlePreviewPlaybackError,
  importSource,
  leaveActiveImportedItem,
  prepareSourceWaveforms,
  switchImportedQueueItemRequested,
} from "@/app/store/thunks/source-media-thunks";
import { trimChanged } from "@/app/store/slices/trim-slice";

const mocks = vi.hoisted(() => ({
  checkMediaCapabilities: vi.fn(),
  chooseSource: vi.fn(),
  inspectMedia: vi.fn(),
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

function sourcePreview(_sourcePath: string, kind: "source" | "proxy" = "source") {
  return { mediaToken: 1, kind, url: `media://source/${kind}` };
}

function audioPreview(_sourcePath: string, streamIndex: number) {
  return { mediaToken: 1, streamIndex, url: `media://source/audio/${streamIndex}` };
}

describe("source/media orchestration thunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chooseSource.mockResolvedValue(null);
    mocks.checkMediaCapabilities.mockResolvedValue({
      ffmpeg: { available: true, version: "ffmpeg" },
      ffprobe: { available: true, version: "ffprobe" },
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

    await appStore.dispatch(importSource(firstSource));

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
    expect(selectImportedQueueItems(appStore.getState())).toHaveLength(1);
    expect(selectImportedQueueItems(appStore.getState())[0]?.origin).toBe("source-import");
    expect(selectActiveItemId(appStore.getState())).toBe(
      selectImportedQueueItems(appStore.getState())[0]?.id,
    );
  });

  it("keeps distinct imported queue items for repeated paths and restores drafts by id", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));

    await appStore.dispatch(importSource(firstSource));
    const firstItem = selectImportedQueueItems(appStore.getState())[0];
    expect(firstItem).toBeDefined();
    appStore.dispatch(
      trimChanged({
        trim: { startMicros: 500_000, endMicros: 4_000_000, sourceDurationMicros: 5_000_000 },
      }),
    );

    await appStore.dispatch(importSource(firstSource));
    const importedItems = selectImportedQueueItems(appStore.getState());
    expect(importedItems).toHaveLength(2);
    expect(new Set(importedItems.map((item) => item.id)).size).toBe(2);
    expect(importedItems.every((item) => item.origin === "source-import")).toBe(true);
    expect(importedItems[0]?.snapshot.trim).toEqual({ startMicros: 500_000, endMicros: 4_000_000 });
    expect(importedItems[0]?.snapshot.source.sourcePath).toBe(firstSource.sourcePath);
    expect(selectActiveItemId(appStore.getState())).toBe(importedItems[1]?.id);

    await expect(appStore.dispatch(switchImportedQueueItemRequested(firstItem!.id))).resolves.toBe(
      true,
    );
    expect(selectActiveItemId(appStore.getState())).toBe(firstItem!.id);
    expect(appStore.getState().trim.value).toMatchObject({
      startMicros: 500_000,
      endMicros: 4_000_000,
    });
  });

  it("captures source-import drafts and preserves them when leaving the active item", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourcePath, 1));

    await appStore.dispatch(importSource(firstSource));
    const importedItem = selectImportedQueueItems(appStore.getState())[0];
    expect(importedItem?.origin).toBe("source-import");
    appStore.dispatch(
      trimChanged({
        trim: { startMicros: 750_000, endMicros: 3_500_000, sourceDurationMicros: 5_000_000 },
      }),
    );

    await appStore.dispatch(leaveActiveImportedItem());

    expect(selectImportedQueueItems(appStore.getState())).toHaveLength(1);
    expect(selectImportedQueueItems(appStore.getState())[0]?.snapshot.trim).toEqual({
      startMicros: 750_000,
      endMicros: 3_500_000,
    });
  });

  it("clears native chooser state before a selected source finishes importing", async () => {
    const appStore = createAppStore();
    const picker = createDeferred<SourceRef | null>();
    const inspection = createDeferred<MediaInfo>();
    mocks.chooseSource.mockReturnValue(picker.promise);
    mocks.inspectMedia.mockReturnValue(inspection.promise);

    const chooserRequest = appStore.dispatch(chooseSourceRequested());
    expect(selectIsChoosingSource(appStore.getState())).toBe(true);
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(true);

    picker.resolve(firstSource);
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
    const picker = createDeferred<SourceRef | null>();
    mocks.chooseSource.mockReturnValue(picker.promise);

    const chooserRequest = appStore.dispatch(chooseSourceRequested());
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(true);
    picker.resolve(null);
    await chooserRequest;

    expect(selectIsChoosingSource(appStore.getState())).toBe(false);
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(false);
    expect(selectHasSource(appStore.getState())).toBe(false);
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });

  it("clears native chooser state and preserves normalized picker errors", async () => {
    const appStore = createAppStore();
    const picker = createDeferred<SourceRef | null>();
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

    await appStore.dispatch(importSource(firstSource));

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

    const firstImport = appStore.dispatch(importSource(firstSource));
    const secondImport = appStore.dispatch(importSource(secondSource));
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

    await appStore.dispatch(importSource(firstSource));
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
    await appStore.dispatch(importSource(firstSource));

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
    await appStore.dispatch(importSource(firstSource));
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

    await appStore.dispatch(importSource(firstSource));

    expect(selectAudioPreviews(appStore.getState())).toMatchObject({
      status: "unavailable",
      error: { code: "io_failed", message: "Audio preview failed" },
    });
  });

  it("keeps only the newest waveform job result", async () => {
    const appStore = createAppStore();
    const sourceMedia = createMedia(firstSource.sourcePath, 2);
    mocks.inspectMedia.mockResolvedValue(sourceMedia);
    await appStore.dispatch(importSource(firstSource));

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
    await appStore.dispatch(importSource(firstSource));
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

    appStore.dispatch(closeSourceRequested());
    expect(selectHasSource(appStore.getState())).toBe(false);
    expect(selectAudioPreviews(appStore.getState())).toBeNull();
  });
});
