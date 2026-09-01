import { describe, expect, it, vi } from "vitest";

import { listenForWindowCloseButtonRequests, requestWindowClose } from "../window";

describe("window close button adapter", () => {
  it("dispatches close button requests to registered listeners", async () => {
    const onCloseRequested = vi.fn();
    const unlisten = listenForWindowCloseButtonRequests(onCloseRequested);

    await requestWindowClose();
    expect(onCloseRequested).toHaveBeenCalledOnce();

    unlisten();
    await requestWindowClose();
    expect(onCloseRequested).toHaveBeenCalledOnce();
  });
});
