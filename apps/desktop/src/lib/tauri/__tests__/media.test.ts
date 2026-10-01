import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  onDragDropEvent: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    constructor() {}
  },
  invoke: mocks.invoke,
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: mocks.onDragDropEvent }),
}));

import {
  activateSourcePath,
  analyzeAudioLoudness,
  checkMediaCapabilities,
  chooseSource,
  detectAudioActivity,
  inspectMedia,
  listenForSourceDrops,
  moveSourceToTrash,
  planOptimizedExport,
  prepareAudioPreviews,
  prepareImportedSourceThumbnail,
  prepareProxyPreview,
  prepareSourcePreview,
  prepareWaveforms,
  releaseImportedSourceThumbnail,
  renderFast,
  saveFramePng,
} from "../media";
import type { MediaInfo } from "../media.types";
import { parseSourceRef } from "../media.utils";

type NativeDropEvent =
  | { payload: { paths: string[]; type: "enter" } }
  | { payload: { type: "over" } }
  | { payload: { paths: string[]; type: "drop" } }
  | { payload: { type: "leave" } };

let nativeDropListener: ((event: NativeDropEvent) => void) | undefined;
const unlisten = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  nativeDropListener = undefined;
  mocks.onDragDropEvent.mockImplementation(async (listener: (event: NativeDropEvent) => void) => {
    nativeDropListener = listener;
    return unlisten;
  });
});

describe("media IPC adapter", () => {
  it("parses audio preview descriptors and preserves canonical signal effects", async () => {
    const audioTracks = [
      {
        streamIndex: 2,
        processing: {
          gainDb: 3,
          loudnessNormalization: "streaming" as const,
          effects: [
            { cutoffHz: 120, stage: "cleanup" as const, type: "highPass" as const },
            {
              preset: "strong" as const,
              stage: "cleanup" as const,
              type: "noiseReduction" as const,
            },
            { ceilingDb: -1, stage: "finalProtection" as const, type: "limiter" as const },
          ],
        },
      },
    ];

    const descriptor = {
      mediaToken: 4,
      previewRevision: 12,
      processing: audioTracks[0]!.processing,
      streamIndex: 2,
      url: "easytrim-media://localhost/4?variant=audio&stream=2&revision=12",
    };

    mocks.invoke.mockResolvedValueOnce([descriptor]);

    await expect(prepareAudioPreviews("C:/Media/clip.mp4", audioTracks)).resolves.toEqual([
      {
        ...descriptor,
        processing: {
          ...audioTracks[0]!.processing,
          effects: [
            { cutoffHz: 120, stage: "cleanup", type: "highPass" },
            { preset: "strong", stage: "cleanup", type: "noiseReduction" },
            { ceilingDb: -1, stage: "finalProtection", type: "limiter" },
          ],
        },
      },
    ]);
    expect(mocks.invoke).toHaveBeenCalledWith("prepare_audio_previews", {
      sourcePath: "C:/Media/clip.mp4",
      audioTracks,
    });
  });

  it.each([
    { ceilingDb: -25, stage: "finalProtection", type: "limiter" },
    { ceilingDb: -1, stage: "cleanup", type: "limiter" },
  ])("rejects an invalid limiter returned in an audio preview descriptor", async (effect) => {
    mocks.invoke.mockResolvedValueOnce([
      {
        mediaToken: 4,
        previewRevision: 12,
        processing: { gainDb: 0, effects: [effect] },
        streamIndex: 2,
        url: "easytrim-media://localhost/4?variant=audio&stream=2&revision=12",
      },
    ]);

    await expect(
      prepareAudioPreviews("C:/Media/clip.mp4", [{ streamIndex: 2, processing: { gainDb: 0 } }]),
    ).rejects.toThrow();
  });

  it("rejects duplicate singleton effects returned in an audio preview descriptor", async () => {
    const limiter = { ceilingDb: -1, stage: "finalProtection", type: "limiter" };
    mocks.invoke.mockResolvedValueOnce([
      {
        mediaToken: 4,
        previewRevision: 12,
        processing: { gainDb: 0, effects: [limiter, { ...limiter, ceilingDb: -2 }] },
        streamIndex: 2,
        url: "easytrim-media://localhost/4?variant=audio&stream=2&revision=12",
      },
    ]);

    await expect(
      prepareAudioPreviews("C:/Media/clip.mp4", [{ streamIndex: 2, processing: { gainDb: 0 } }]),
    ).rejects.toThrow();
  });

  it("converts detected silence to activity ranges for one track", async () => {
    const track = { streamIndex: 2, processing: { gainDb: -3 } };

    mocks.invoke.mockResolvedValueOnce([{ startMicros: 1_000_000, endMicros: 2_500_000 }]);

    await expect(detectAudioActivity("C:/Media/clip.mp4", track, 5_000_000)).resolves.toEqual([
      { startMicros: 0, endMicros: 1_000_000 },
      { startMicros: 2_500_000, endMicros: 5_000_000 },
    ]);
    expect(mocks.invoke).toHaveBeenCalledWith("detect_silence", {
      sourcePath: "C:/Media/clip.mp4",
      track,
    });
  });

  it("returns no activity ranges when the detected silence covers the source", async () => {
    mocks.invoke.mockResolvedValueOnce([{ startMicros: 0, endMicros: 5_000_000 }]);

    await expect(
      detectAudioActivity(
        "C:/Media/clip.mp4",
        { streamIndex: 2, processing: { gainDb: 0 } },
        5_000_000,
      ),
    ).resolves.toEqual([]);
  });

  it("analyzes the requested segment and parses unavailable measurements", async () => {
    mocks.invoke
      .mockResolvedValueOnce("operation-1")
      .mockResolvedValueOnce({ integratedLufs: -18.4, truePeakDb: null });
    const request = {
      sourcePath: "C:/Media/clip.mp4",
      trim: { startMicros: 1_000_000, endMicros: 4_000_000 },
      audioTrack: {
        streamIndex: 2,
        processing: { gainDb: -2, loudnessNormalization: "webVideo" as const },
      },
    };

    await expect(analyzeAudioLoudness(request)).resolves.toEqual({
      integratedLufs: -18.4,
      truePeakDb: undefined,
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "begin_loudness_analysis");
    expect(mocks.invoke).toHaveBeenCalledWith("analyze_audio_loudness", {
      operationId: "operation-1",
      sourcePath: request.sourcePath,
      request: {
        trim: request.trim,
        audioTrack: request.audioTrack,
      },
    });
  });

  it("cancels the owned native loudness operation when its signal aborts", async () => {
    let completeAnalysis: ((result: unknown) => void) | undefined;
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "begin_loudness_analysis") return Promise.resolve("operation-2");
      if (command === "analyze_audio_loudness") {
        return new Promise((resolve) => {
          completeAnalysis = resolve;
        });
      }
      return Promise.resolve();
    });
    const controller = new AbortController();
    const request = {
      sourcePath: "C:/Media/clip.mp4",
      trim: { startMicros: 0, endMicros: 1_000_000 },
      audioTrack: { streamIndex: 2, processing: { gainDb: 0 } },
    };

    const analysis = analyzeAudioLoudness(request, controller.signal);
    await vi.waitFor(() => expect(completeAnalysis).toBeDefined());
    controller.abort();
    await vi.waitFor(() =>
      expect(mocks.invoke).toHaveBeenCalledWith("cancel_operation", {
        operationId: "operation-2",
      }),
    );
    completeAnalysis?.({ integratedLufs: -16, truePeakDb: -1 });
    await expect(analysis).resolves.toEqual({ integratedLufs: -16, truePeakDb: -1 });
  });

  it("saves captured PNG bytes through the native save dialog", async () => {
    const pngData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    mocks.invoke.mockResolvedValue(true);

    await expect(saveFramePng(pngData, "clip_42.png")).resolves.toBe(true);

    expect(mocks.invoke).toHaveBeenCalledWith("save_frame_png", {
      defaultName: "clip_42.png",
      pngData: [137, 80, 78, 71, 13, 10, 26, 10],
    });
  });

  it("parses resolved binary paths and accepts an omitted optional path", async () => {
    mocks.invoke.mockResolvedValue({
      ffmpeg: { available: true, path: "C:/Tools/ffmpeg.exe", version: "ffmpeg version 7.1" },
      ffprobe: { available: true, version: "ffprobe version 7.1" },
    });

    await expect(checkMediaCapabilities()).resolves.toEqual({
      ffmpeg: { available: true, path: "C:/Tools/ffmpeg.exe", version: "ffmpeg version 7.1" },
      ffprobe: { available: true, path: undefined, version: "ffprobe version 7.1" },
    });
  });

  it("preserves source filesystem timestamps from native metadata", () => {
    expect(
      parseSourceRef({
        createdAtMicros: 1_735_804_800_000_000,
        displayName: "clip.mp4",
        fileSizeBytes: 128,
        sourcePath: "C:/Media/clip.mp4",
        updatedAtMicros: 1_735_804_900_000_000,
      }),
    ).toEqual({
      createdAtMicros: 1_735_804_800_000_000,
      displayName: "clip.mp4",
      fileSizeBytes: 128,
      sourcePath: "C:/Media/clip.mp4",
      updatedAtMicros: 1_735_804_900_000_000,
    });
  });

  it("accepts a source selection with its physical path", async () => {
    mocks.invoke.mockResolvedValue([
      { displayName: "clip.mp4", sourcePath: "C:/Media/clip.mp4" },
      { displayName: "second.mp4", sourcePath: "C:/Media/second.mp4" },
      { displayName: "third.mp4", sourcePath: "C:/Media/third.mp4" },
    ]);

    await expect(chooseSource()).resolves.toMatchObject({
      acceptedFileCount: 3,
      directFileCount: 3,
      folderCount: 0,
      sources: [
        { displayName: "clip.mp4", sourcePath: "C:/Media/clip.mp4" },
        { displayName: "second.mp4", sourcePath: "C:/Media/second.mp4" },
        { displayName: "third.mp4", sourcePath: "C:/Media/third.mp4" },
      ],
    });
    expect(mocks.invoke).toHaveBeenCalledWith("choose_source", { mode: "files" });
  });

  it("selects folders through the same command without changing file selection mode", async () => {
    mocks.invoke.mockResolvedValue({
      acceptedFileCount: 2,
      directFileCount: 0,
      discoveredFileCount: 2,
      folderCount: 1,
      readErrorCount: 0,
      recursive: true,
      skippedFileCount: 0,
      sources: [
        { displayName: "clip.mp4", sourcePath: "C:/Media/Folder/clip.mp4" },
        { displayName: "second.mp4", sourcePath: "C:/Media/Folder/second.mp4" },
      ],
      truncated: false,
    });

    await expect(chooseSource("folders")).resolves.toMatchObject({
      folderCount: 1,
      sources: [
        { displayName: "clip.mp4", sourcePath: "C:/Media/Folder/clip.mp4" },
        { displayName: "second.mp4", sourcePath: "C:/Media/Folder/second.mp4" },
      ],
    });
    expect(mocks.invoke).toHaveBeenCalledWith("choose_source", { mode: "folders" });
  });

  it("imports a source by its physical path", async () => {
    mocks.invoke.mockResolvedValue({
      displayName: "clip.mp4",
      sourcePath: "C:/Media/clip.mp4",
    });

    await expect(activateSourcePath("C:/Media/clip.mp4")).resolves.toEqual({
      displayName: "clip.mp4",
      sourcePath: "C:/Media/clip.mp4",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("activate_source_path", {
      sourcePath: "C:/Media/clip.mp4",
    });
  });

  it("hydrates an activated source with cached media metadata", async () => {
    mocks.invoke.mockResolvedValue({
      displayName: "clip.mp4",
      sourcePath: "C:/Media/clip.mp4",
    });

    const cachedMedia = {
      audioStreams: [],
      chapters: [],
      durationMicros: 1,
      formatName: "mp4",
      video: {
        codecName: "h264",
        height: 1,
        streamIndex: 0,
        width: 1,
      },
    } satisfies MediaInfo;

    await activateSourcePath("C:/Media/clip.mp4", cachedMedia);

    expect(mocks.invoke).toHaveBeenCalledWith("activate_source_path", {
      media: cachedMedia,
      sourcePath: "C:/Media/clip.mp4",
    });
  });

  it("moves a source to trash through the narrow command", async () => {
    mocks.invoke.mockResolvedValue(undefined);

    await moveSourceToTrash("C:/Media/clip.mp4");

    expect(mocks.invoke).toHaveBeenCalledWith("delete_source_file", {
      sourcePath: "C:/Media/clip.mp4",
    });
  });

  it("rejects malformed native metadata at the IPC boundary", async () => {
    mocks.invoke.mockResolvedValue({
      formatName: "matroska",
      durationMicros: "not-an-integer",
    });

    await expect(inspectMedia("C:/Media/clip.mp4")).rejects.toEqual({
      code: "internal",
      message: "The native application returned an invalid duration.",
    });
  });

  it("parses a path-redacted optimized export plan", async () => {
    mocks.invoke.mockResolvedValue({
      commandPreview: "ffmpeg -i <source> -c:v hevc_nvenc <output>",
    });
    const request = {
      sourcePath: "C:/Media/clip.mp4",
      trim: { startMicros: 0, endMicros: 1_000_000 },
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0 as const,
      resolution: { width: 1920, height: 1080 },
      arguments: "-c:v hevc_nvenc",
    };

    await expect(planOptimizedExport(request)).resolves.toEqual({
      commandPreview: "ffmpeg -i <source> -c:v hevc_nvenc <output>",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("plan_optimized_export", { request });
  });

  it("passes the frontend diagnostic operation as the native export parent", async () => {
    mocks.invoke.mockResolvedValue({
      operationId: "native-op-1",
      displayName: "clip.mkv",
      displayPath: "C:/Exports/clip.mkv",
    });
    const request = {
      sourcePath: "C:/Media/clip.mp4",
      trim: { startMicros: 0, endMicros: 1_000_000 },
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0 as const,
    };

    await expect(
      renderFast(request, "output-1", vi.fn(), "diagnostic-op-1", "snapshot-1"),
    ).resolves.toEqual({
      operationId: "native-op-1",
      displayName: "clip.mkv",
      displayPath: "C:/Exports/clip.mkv",
    });
    expect(mocks.invoke).toHaveBeenCalledWith(
      "render_fast",
      expect.objectContaining({
        request,
        outputId: "output-1",
        diagnosticParentOperationId: "diagnostic-op-1",
        diagnosticSnapshotId: "snapshot-1",
      }),
    );
  });

  it("parses direct, imported, and proxy preview descriptors through narrow commands", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        mediaToken: 3,
        url: "http://easytrim-media.localhost/source-3?variant=source",
        kind: "source",
      })
      .mockResolvedValueOnce({
        mediaToken: 9,
        url: "http://easytrim-media.localhost/9?variant=thumbnail",
      })
      .mockResolvedValueOnce({
        mediaToken: 3,
        url: "http://easytrim-media.localhost/source-3?variant=proxy",
        kind: "proxy",
      });

    await expect(prepareSourcePreview("C:/Media/clip.mp4")).resolves.toMatchObject({
      kind: "source",
    });
    await expect(prepareImportedSourceThumbnail("C:/Media/clip.mp4")).resolves.toMatchObject({
      mediaToken: 9,
    });
    await expect(prepareProxyPreview("C:/Media/clip.mp4")).resolves.toMatchObject({
      kind: "proxy",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "prepare_source_preview", {
      sourcePath: "C:/Media/clip.mp4",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "prepare_imported_source_thumbnail", {
      sourcePath: "C:/Media/clip.mp4",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, "prepare_proxy_preview", {
      sourcePath: "C:/Media/clip.mp4",
    });
  });

  it("releases an imported thumbnail token through its narrow command", async () => {
    mocks.invoke.mockResolvedValue(undefined);

    await releaseImportedSourceThumbnail(9);

    expect(mocks.invoke).toHaveBeenCalledWith("release_imported_source_thumbnail", {
      mediaToken: 9,
    });
  });

  it("rejects an unknown preview kind at the IPC boundary", async () => {
    mocks.invoke.mockResolvedValue({
      mediaToken: 3,
      url: "http://easytrim-media.localhost/source-3",
      kind: "filesystem",
    });

    await expect(prepareSourcePreview("C:/Media/clip.mp4")).rejects.toEqual({
      code: "internal",
      message: "The native application returned an invalid preview kind.",
    });
  });

  it("parses per-stream waveform results and preserves structured failures", async () => {
    mocks.invoke.mockResolvedValue([
      {
        status: "ready",
        jobId: "waveform-7",
        streamIndex: 2,
        width: 1280,
        hasSignal: false,
        url: "http://easytrim-media.localhost/source-3?variant=waveform&stream=2&width=1280",
      },
      {
        status: "failed",
        jobId: "waveform-7",
        streamIndex: 4,
        width: 1280,
        error: {
          code: "waveform_failed",
          message: "Waveform generation failed for audio stream #4.",
        },
      },
    ]);

    await expect(
      prepareWaveforms("C:/Media/clip.mp4", "waveform-7", [2, 4], 1280),
    ).resolves.toEqual([
      expect.objectContaining({ status: "ready", streamIndex: 2, hasSignal: false }),
      expect.objectContaining({
        status: "failed",
        streamIndex: 4,
        error: expect.objectContaining({ code: "waveform_failed" }),
      }),
    ]);
    expect(mocks.invoke).toHaveBeenCalledWith("prepare_waveforms", {
      sourcePath: "C:/Media/clip.mp4",
      jobId: "waveform-7",
      streamIndexes: [2, 4],
      width: 1280,
      processingByStream: {},
    });
  });

  it("rejects malformed waveform results at the IPC boundary", async () => {
    mocks.invoke.mockResolvedValue([
      {
        status: "ready",
        jobId: "waveform-7",
        streamIndex: 2,
        width: 0,
        url: "http://easytrim-media.localhost/source-3",
      },
    ]);

    await expect(prepareWaveforms("C:/Media/clip.mp4", "waveform-7", [2], 1280)).rejects.toEqual({
      code: "internal",
      message: "The native application returned an invalid waveform width.",
      diagnostics: undefined,
    });
  });

  it("maps official webview drag events to path-free UI state", async () => {
    const onEvent = vi.fn();

    await expect(listenForSourceDrops(onEvent)).resolves.toBe(unlisten);
    nativeDropListener?.({ payload: { type: "enter", paths: ["C:\\private\\video.mkv"] } });
    nativeDropListener?.({ payload: { type: "leave" } });

    expect(onEvent).toHaveBeenNthCalledWith(1, { status: "drag", active: true });
    expect(onEvent).toHaveBeenNthCalledWith(2, { status: "drag", active: false });
  });

  it("imports a dropped path through Rust and preserves its physical identity", async () => {
    mocks.invoke.mockResolvedValue([
      { displayName: "video.mkv", sourcePath: "C:\\private\\video.mkv" },
    ]);
    const onEvent = vi.fn();
    await listenForSourceDrops(onEvent);

    nativeDropListener?.({ payload: { type: "drop", paths: ["C:\\private\\video.mkv"] } });

    await vi.waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("import_dropped_sources", {
        paths: ["C:\\private\\video.mkv"],
      });
      expect(onEvent).toHaveBeenLastCalledWith({
        importResult: expect.objectContaining({
          acceptedFileCount: 1,
          directFileCount: 1,
          folderCount: 0,
          sources: [{ displayName: "video.mkv", sourcePath: "C:\\private\\video.mkv" }],
        }),
        status: "selected",
      });
    });
  });

  it("normalizes a rejected dropped path into a structured failure", async () => {
    mocks.invoke.mockRejectedValue({
      code: "unsupported_media",
      message: "This file type is not supported yet.",
    });
    const onEvent = vi.fn();
    await listenForSourceDrops(onEvent);

    nativeDropListener?.({ payload: { type: "drop", paths: ["C:\\private\\notes.txt"] } });

    await vi.waitFor(() => {
      expect(onEvent).toHaveBeenLastCalledWith({
        status: "failed",
        error: {
          code: "unsupported_media",
          message: "This file type is not supported yet.",
          diagnostics: undefined,
        },
      });
    });
  });

  it("imports every dropped path in platform order", async () => {
    mocks.invoke.mockResolvedValue([
      { displayName: "a.mp4", sourcePath: "C:/Media/a.mp4" },
      { displayName: "b.mp4", sourcePath: "C:/Media/b.mp4" },
      { displayName: "c.mp4", sourcePath: "C:/Media/c.mp4" },
    ]);
    const onEvent = vi.fn();
    await listenForSourceDrops(onEvent);

    nativeDropListener?.({
      payload: { type: "drop", paths: ["C:/Media/a.mp4", "C:/Media/b.mp4", "C:/Media/c.mp4"] },
    });

    await vi.waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("import_dropped_sources", {
        paths: ["C:/Media/a.mp4", "C:/Media/b.mp4", "C:/Media/c.mp4"],
      });
      expect(onEvent).toHaveBeenLastCalledWith({
        importResult: expect.objectContaining({
          acceptedFileCount: 3,
          directFileCount: 3,
          folderCount: 0,
          sources: [
            { displayName: "a.mp4", sourcePath: "C:/Media/a.mp4" },
            { displayName: "b.mp4", sourcePath: "C:/Media/b.mp4" },
            { displayName: "c.mp4", sourcePath: "C:/Media/c.mp4" },
          ],
        }),
        status: "selected",
      });
    });
  });

  it("reports an empty native drop without invoking Rust", async () => {
    const onEvent = vi.fn();
    await listenForSourceDrops(onEvent);

    nativeDropListener?.({ payload: { type: "drop", paths: [] } });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenLastCalledWith({
      status: "failed",
      error: {
        code: "invalid_request",
        message: "Drop a video file instead of an empty selection.",
      },
    });
  });
});
