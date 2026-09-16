import { describe, expect, it, vi } from "vitest";

const nativeWindow = vi.hoisted(() => ({
  close: vi.fn(() => Promise.resolve()),
  innerSize: vi.fn(() => Promise.resolve({ toLogical: () => ({ height: 800, width: 1280 }) })),
  isMaximized: vi.fn(() => Promise.resolve(false)),
  isResizable: vi.fn(() => Promise.resolve(true)),
  maximize: vi.fn(() => Promise.resolve()),
  scaleFactor: vi.fn(() => Promise.resolve(1)),
  setMinSize: vi.fn(() => Promise.resolve()),
  setResizable: vi.fn(() => Promise.resolve()),
  setSize: vi.fn(() => Promise.resolve()),
  unmaximize: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => nativeWindow,
}));

import {
  enterCompactWindow,
  listenForWindowShutdownRequests,
  requestWindowShutdown,
  restoreEditorWindow,
} from "../window";

describe("window shutdown adapter", () => {
  it("dispatches shutdown requests and continuations to registered listeners", async () => {
    const onCloseRequested = vi.fn();
    const continuation = vi.fn();
    const unlisten = listenForWindowShutdownRequests(onCloseRequested);

    await requestWindowShutdown(continuation);
    expect(onCloseRequested).toHaveBeenCalledWith(continuation);

    unlisten();
    await requestWindowShutdown();
    expect(onCloseRequested).toHaveBeenCalledOnce();
  });

  it("falls back to the native close when no shutdown listener is registered", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });

    await requestWindowShutdown();

    expect(nativeWindow.close).toHaveBeenCalledOnce();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });
});

describe("compact window adapter", () => {
  it("uses a fixed 32:9 size and restores the previous editor geometry", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });

    const snapshot = await enterCompactWindow();

    expect(snapshot).toEqual({
      height: 800,
      isMaximized: false,
      isResizable: true,
      width: 1280,
    });
    expect(nativeWindow.setMinSize).toHaveBeenCalledWith(null);
    expect(nativeWindow.setSize).toHaveBeenCalledWith(
      expect.objectContaining({ height: 180, width: 640 }),
    );
    expect(nativeWindow.setResizable).toHaveBeenCalledWith(false);

    await restoreEditorWindow(snapshot);

    expect(nativeWindow.setMinSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ height: 640, width: 960 }),
    );
    expect(nativeWindow.setSize).toHaveBeenLastCalledWith(
      expect.objectContaining({ height: 800, width: 1280 }),
    );
    expect(nativeWindow.setResizable).toHaveBeenLastCalledWith(true);

    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });
});
