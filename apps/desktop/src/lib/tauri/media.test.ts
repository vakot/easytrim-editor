import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: mocks.listen }));

import { chooseSource, inspectMedia, listenForSourceDrag, listenForSourceImports } from "./media";

beforeEach(() => {
  vi.clearAllMocks();
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

  it("normalizes malformed source events into a structured failure", async () => {
    const unlisten = vi.fn();
    let nativeListener: ((event: { payload: unknown }) => void) | undefined;
    mocks.listen.mockImplementation(
      async (_eventName: string, listener: (event: { payload: unknown }) => void) => {
        nativeListener = listener;
        return unlisten;
      },
    );
    const onImport = vi.fn();

    await expect(listenForSourceImports(onImport)).resolves.toBe(unlisten);
    nativeListener?.({ payload: { status: "unexpected" } });

    expect(onImport).toHaveBeenCalledWith({
      status: "failed",
      error: {
        code: "internal",
        message: "The native application returned an invalid source import event.",
      },
    });
  });

  it("validates native drag state without exposing dropped paths", async () => {
    const unlisten = vi.fn();
    let nativeListener: ((event: { payload: unknown }) => void) | undefined;
    mocks.listen.mockImplementation(
      async (_eventName: string, listener: (event: { payload: unknown }) => void) => {
        nativeListener = listener;
        return unlisten;
      },
    );
    const onDrag = vi.fn();

    await expect(listenForSourceDrag(onDrag)).resolves.toBe(unlisten);
    nativeListener?.({ payload: { active: true, path: "C:\\private\\video.mkv" } });

    expect(onDrag).toHaveBeenCalledWith({ active: true });
  });

  it("clears the drag overlay for malformed native state", async () => {
    let nativeListener: ((event: { payload: unknown }) => void) | undefined;
    mocks.listen.mockImplementation(
      async (_eventName: string, listener: (event: { payload: unknown }) => void) => {
        nativeListener = listener;
        return vi.fn();
      },
    );
    const onDrag = vi.fn();

    await listenForSourceDrag(onDrag);
    nativeListener?.({ payload: { active: "yes" } });

    expect(onDrag).toHaveBeenCalledWith({ active: false });
  });
});
