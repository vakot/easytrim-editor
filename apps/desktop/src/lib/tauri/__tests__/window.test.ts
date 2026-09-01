import { describe, expect, it, vi } from "vitest";

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
});
