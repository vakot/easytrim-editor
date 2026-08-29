import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  onDragDropEvent: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: mocks.onDragDropEvent }),
}));

import {
  activateSourcePath,
  chooseSource,
  inspectMedia,
  listenForSourceDrops,
  planOptimizedExport,
  prepareProxyPreview,
  prepareSourcePreview,
  prepareWaveforms,
} from "../media";

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
  it("accepts a source selection with its physical path", async () => {
    mocks.invoke.mockResolvedValue([
      { displayName: "clip.mp4", sourcePath: "C:/Media/clip.mp4" },
      { displayName: "second.mp4", sourcePath: "C:/Media/second.mp4" },
      { displayName: "third.mp4", sourcePath: "C:/Media/third.mp4" },
    ]);

    await expect(chooseSource()).resolves.toEqual([
      { displayName: "clip.mp4", sourcePath: "C:/Media/clip.mp4" },
      { displayName: "second.mp4", sourcePath: "C:/Media/second.mp4" },
      { displayName: "third.mp4", sourcePath: "C:/Media/third.mp4" },
    ]);
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
      resolution: { width: 1920, height: 1080 },
      arguments: "-c:v hevc_nvenc",
    };

    await expect(planOptimizedExport(request)).resolves.toEqual({
      commandPreview: "ffmpeg -i <source> -c:v hevc_nvenc <output>",
    });
    expect(mocks.invoke).toHaveBeenCalledWith("plan_optimized_export", { request });
  });

  it("parses direct and proxy preview descriptors through narrow commands", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        mediaToken: 3,
        url: "http://easytrim-media.localhost/source-3?variant=source",
        kind: "source",
      })
      .mockResolvedValueOnce({
        mediaToken: 3,
        url: "http://easytrim-media.localhost/source-3?variant=proxy",
        kind: "proxy",
      });

    await expect(prepareSourcePreview("C:/Media/clip.mp4")).resolves.toMatchObject({
      kind: "source",
    });
    await expect(prepareProxyPreview("C:/Media/clip.mp4")).resolves.toMatchObject({
      kind: "proxy",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "prepare_source_preview", {
      sourcePath: "C:/Media/clip.mp4",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "prepare_proxy_preview", {
      sourcePath: "C:/Media/clip.mp4",
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
        status: "selected",
        sources: [{ displayName: "video.mkv", sourcePath: "C:\\private\\video.mkv" }],
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
        status: "selected",
        sources: [
          { displayName: "a.mp4", sourcePath: "C:/Media/a.mp4" },
          { displayName: "b.mp4", sourcePath: "C:/Media/b.mp4" },
          { displayName: "c.mp4", sourcePath: "C:/Media/c.mp4" },
        ],
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
