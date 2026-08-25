import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaInfo, SourceSelection, WaveformResult } from "@/lib/tauri/media";
import { createAppStore } from "@/app/store/store";
import {
  selectAudioPreviews,
  selectActiveSource,
  selectSessionStatus,
} from "@/app/store/slices/session-slice";
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
  prepareSourceWaveforms,
} from "@/app/store/thunks/source-media-thunks";

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

const firstSource: SourceSelection = { sourceId: "source-a", displayName: "first.mp4" };
const secondSource: SourceSelection = { sourceId: "source-b", displayName: "second.mp4" };

function createMedia(sourceId: string, audioCount = 2): MediaInfo {
  return {
    sourceId,
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

function sourcePreview(sourceId: string, kind: "source" | "proxy" = "source") {
  return { sourceId, kind, url: `media://${sourceId}/${kind}` };
}

function audioPreview(sourceId: string, streamIndex: number) {
  return { sourceId, streamIndex, url: `media://${sourceId}/audio/${streamIndex}` };
}

describe("source/media orchestration thunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chooseSource.mockResolvedValue(null);
    mocks.checkMediaCapabilities.mockResolvedValue({
      ffmpeg: { available: true, version: "ffmpeg" },
      ffprobe: { available: true, version: "ffprobe" },
    });
    mocks.prepareSourcePreview.mockImplementation(async (sourceId: string) =>
      sourcePreview(sourceId),
    );
    mocks.prepareProxyPreview.mockImplementation(async (sourceId: string) =>
      sourcePreview(sourceId, "proxy"),
    );
    mocks.prepareAudioPreviews.mockImplementation(async (sourceId: string, indexes: number[]) =>
      indexes.map((streamIndex) => audioPreview(sourceId, streamIndex)),
    );
    mocks.prepareWaveforms.mockImplementation(
      async (sourceId: string, jobId: string, indexes: number[], width: number) =>
        indexes.map((streamIndex): WaveformResult => ({
          status: "ready",
          sourceId,
          jobId,
          streamIndex,
          width,
          url: `media://${sourceId}/waveform/${streamIndex}/${width}`,
        })),
    );
  });

  it("coordinates inspect, source preview, and multiple audio previews", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourceId, 2));

    await appStore.dispatch(importSource(firstSource));

    const state = appStore.getState();
    expect(selectActiveSource(state)?.media?.sourceId).toBe(firstSource.sourceId);
    expect(selectActiveSource(state)?.preview).toMatchObject({ status: "ready" });
    expect(selectAudioPreviews(state)).toMatchObject({
      status: "ready",
      previews: [audioPreview(firstSource.sourceId, 1), audioPreview(firstSource.sourceId, 2)],
    });
    expect(mocks.prepareAudioPreviews).toHaveBeenCalledWith(firstSource.sourceId, [1, 2]);
  });

  it("clears native chooser state before a selected source finishes importing", async () => {
    const appStore = createAppStore();
    const picker = createDeferred<SourceSelection | null>();
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
    expect(selectSessionStatus(appStore.getState())).toBe("loading-source");
    expect(mocks.inspectMedia).toHaveBeenCalledWith(firstSource.sourceId);

    inspection.resolve(createMedia(firstSource.sourceId, 1));
    await chooserRequest;
    expect(selectSessionStatus(appStore.getState())).toBe("ready");
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(false);
  });

  it("clears native chooser state when the picker is cancelled", async () => {
    const appStore = createAppStore();
    const picker = createDeferred<SourceSelection | null>();
    mocks.chooseSource.mockReturnValue(picker.promise);

    const chooserRequest = appStore.dispatch(chooseSourceRequested());
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(true);
    picker.resolve(null);
    await chooserRequest;

    expect(selectIsChoosingSource(appStore.getState())).toBe(false);
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(false);
    expect(selectActiveSource(appStore.getState())).toBeNull();
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });

  it("clears native chooser state and preserves normalized picker errors", async () => {
    const appStore = createAppStore();
    const picker = createDeferred<SourceSelection | null>();
    mocks.chooseSource.mockReturnValue(picker.promise);

    const chooserRequest = appStore.dispatch(chooseSourceRequested());
    picker.reject({ code: "dialog_failed", message: "The source picker failed." });
    await chooserRequest;

    expect(selectIsChoosingSource(appStore.getState())).toBe(false);
    expect(selectIsNativeDialogOpen(appStore.getState())).toBe(false);
    expect(appStore.getState().session).toMatchObject({
      status: "failed",
      lastError: { code: "dialog_failed", message: "The source picker failed." },
    });
    expect(mocks.inspectMedia).not.toHaveBeenCalled();
  });

  it("marks single-stream audio preparation ready without invoking a native job", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourceId, 1));

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
    mocks.inspectMedia.mockImplementation((sourceId: string) =>
      sourceId === firstSource.sourceId ? firstInspection.promise : secondInspection.promise,
    );

    const firstImport = appStore.dispatch(importSource(firstSource));
    const secondImport = appStore.dispatch(importSource(secondSource));
    secondInspection.resolve(createMedia(secondSource.sourceId, 1));
    await secondImport;
    firstInspection.resolve(createMedia(firstSource.sourceId, 2));
    await firstImport;

    expect(selectActiveSource(appStore.getState())?.selection).toEqual(secondSource);
    expect(mocks.prepareSourcePreview).toHaveBeenCalledTimes(1);
    expect(mocks.prepareSourcePreview).toHaveBeenCalledWith(secondSource.sourceId);
  });

  it("records inspection failures and capability failures as serializable app errors", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockRejectedValue({ code: "unsupported_media", message: "Not a video" });

    await appStore.dispatch(importSource(firstSource));
    expect(appStore.getState().session).toMatchObject({
      status: "failed",
      lastError: { code: "unsupported_media", message: "Not a video" },
    });

    mocks.checkMediaCapabilities.mockRejectedValue(new Error("ffmpeg missing"));
    await appStore.dispatch(checkMediaCapabilitiesRequested());
    expect(appStore.getState().session.capabilities).toMatchObject({
      status: "failed",
      error: { code: "internal", message: "ffmpeg missing" },
    });
  });

  it("falls back from source preview playback to a proxy preview", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourceId, 1));
    await appStore.dispatch(importSource(firstSource));

    await appStore.dispatch(handlePreviewPlaybackError(firstSource.sourceId, "source"));

    expect(mocks.prepareProxyPreview).toHaveBeenCalledWith(firstSource.sourceId);
    expect(selectActiveSource(appStore.getState())?.preview).toMatchObject({
      status: "ready",
      value: sourcePreview(firstSource.sourceId, "proxy"),
    });
  });

  it("marks proxy playback failure as the final preview failure", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourceId, 1));
    await appStore.dispatch(importSource(firstSource));
    mocks.prepareProxyPreview.mockRejectedValue({
      code: "unsupported_media",
      message: "No compatible preview could be created",
    });

    await appStore.dispatch(handlePreviewPlaybackError(firstSource.sourceId, "source"));
    await appStore.dispatch(handlePreviewPlaybackError(firstSource.sourceId, "proxy"));

    expect(selectActiveSource(appStore.getState())?.preview).toMatchObject({
      status: "failed",
      error: { code: "preview_playback_failed" },
    });
  });

  it("keeps audio previews unavailable when preparation fails", async () => {
    const appStore = createAppStore();
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourceId, 2));
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
    const sourceMedia = createMedia(firstSource.sourceId, 2);
    mocks.inspectMedia.mockResolvedValue(sourceMedia);
    await appStore.dispatch(importSource(firstSource));

    const jobs = new Map<string, ReturnType<typeof createDeferred<WaveformResult[]>>>();
    mocks.prepareWaveforms.mockImplementation((_sourceId: string, jobId: string) => {
      const deferred = createDeferred<WaveformResult[]>();
      jobs.set(jobId, deferred);
      return deferred.promise;
    });

    const firstJob = appStore.dispatch(prepareSourceWaveforms(firstSource.sourceId, [1, 2], 800));
    await vi.waitFor(() => expect(jobs.size).toBe(1));
    const firstJobId = [...jobs.keys()][0] as string;
    const secondJob = appStore.dispatch(prepareSourceWaveforms(firstSource.sourceId, [1, 2], 1200));
    await vi.waitFor(() => expect(jobs.size).toBe(2));
    const secondJobId = [...jobs.keys()][1] as string;

    jobs.get(secondJobId)?.resolve([
      {
        status: "ready",
        sourceId: firstSource.sourceId,
        jobId: secondJobId,
        streamIndex: 1,
        width: 1200,
        url: "media://new-waveform",
      },
    ]);
    jobs.get(firstJobId)?.resolve([
      {
        status: "ready",
        sourceId: firstSource.sourceId,
        jobId: firstJobId,
        streamIndex: 1,
        width: 800,
        url: "media://stale-waveform",
      },
    ]);
    await Promise.all([firstJob, secondJob]);

    const track = selectActiveSource(appStore.getState())?.audioTracks.find(
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
    mocks.inspectMedia.mockResolvedValue(createMedia(firstSource.sourceId, 1));
    await appStore.dispatch(importSource(firstSource));
    mocks.prepareWaveforms.mockRejectedValue({
      code: "waveform_failed",
      message: "Waveform generation failed",
    });

    await appStore.dispatch(prepareSourceWaveforms(firstSource.sourceId, [1], 800));
    const waveform = selectActiveSource(appStore.getState())?.audioTracks[0]?.waveform;
    expect(waveform).toMatchObject({
      status: "failed",
      error: { code: "waveform_failed", message: "Waveform generation failed" },
    });

    appStore.dispatch(closeSourceRequested());
    expect(selectActiveSource(appStore.getState())).toBeNull();
    expect(selectAudioPreviews(appStore.getState())).toBeNull();
  });
});
