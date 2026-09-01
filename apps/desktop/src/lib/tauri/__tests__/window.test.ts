import { describe, expect, it, vi } from "vitest";

const nativeWindow = vi.hoisted(() => ({
  close: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => nativeWindow,
}));

import { listenForWindowShutdownRequests, requestWindowShutdown } from "../window";

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
