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
  chooseSource,
  inspectMedia,
  listenForSourceDrops,
  prepareProxyPreview,
  prepareSourcePreview,
} from "./media";

type NativeDropEvent =
  | { payload: { type: "enter"; paths: string[] } }
  | { payload: { type: "over" } }
  | { payload: { type: "drop"; paths: string[] } }
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
  it("accepts an opaque source selection without exposing a path", async () => {
    mocks.invoke.mockResolvedValue({
      sourceId: "source-3",
      displayName: "clip.mp4",
    });

    await expect(chooseSource()).resolves.toEqual({
      sourceId: "source-3",
      displayName: "clip.mp4",
    });
  });

  it("rejects malformed native metadata at the IPC boundary", async () => {
    mocks.invoke.mockResolvedValue({
      sourceId: "source-3",
      formatName: "matroska",
      durationMicros: "not-an-integer",
    });

    await expect(inspectMedia("source-3")).rejects.toEqual({
      code: "internal",
      message: "The native application returned an invalid duration.",
    });
  });

  it("parses direct and proxy preview descriptors through narrow commands", async () => {
    mocks.invoke
      .mockResolvedValueOnce({
        sourceId: "source-3",
        url: "http://easycut-media.localhost/source-3?variant=source",
        kind: "source",
      })
      .mockResolvedValueOnce({
        sourceId: "source-3",
        url: "http://easycut-media.localhost/source-3?variant=proxy",
        kind: "proxy",
      });

    await expect(prepareSourcePreview("source-3")).resolves.toMatchObject({ kind: "source" });
    await expect(prepareProxyPreview("source-3")).resolves.toMatchObject({ kind: "proxy" });
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, "prepare_source_preview", {
      sourceId: "source-3",
    });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, "prepare_proxy_preview", {
      sourceId: "source-3",
    });
  });

  it("rejects an unknown preview kind at the IPC boundary", async () => {
    mocks.invoke.mockResolvedValue({
      sourceId: "source-3",
      url: "http://easycut-media.localhost/source-3",
      kind: "filesystem",
    });

    await expect(prepareSourcePreview("source-3")).rejects.toEqual({
      code: "internal",
      message: "The native application returned an invalid preview kind.",
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

  it("imports a dropped path through Rust and emits only opaque source metadata", async () => {
    mocks.invoke.mockResolvedValue({
      sourceId: "source-4",
      displayName: "video.mkv",
    });
    const onEvent = vi.fn();
    await listenForSourceDrops(onEvent);

    nativeDropListener?.({ payload: { type: "drop", paths: ["C:\\private\\video.mkv"] } });

    await vi.waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith("import_dropped_source", {
        path: "C:\\private\\video.mkv",
      });
      expect(onEvent).toHaveBeenLastCalledWith({
        status: "selected",
        source: { sourceId: "source-4", displayName: "video.mkv" },
      });
    });
    expect(JSON.stringify(onEvent.mock.calls)).not.toContain("C:\\private\\video.mkv");
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
