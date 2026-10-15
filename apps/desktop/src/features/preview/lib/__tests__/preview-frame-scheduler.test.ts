import { afterEach, describe, expect, it, vi } from "vitest";

import { requestPreviewPlaybackFrame } from "../preview-frame-scheduler";

afterEach(() => vi.unstubAllGlobals());

describe("preview playback frame scheduling", () => {
  it("calls back on the next display refresh and can be cancelled", () => {
    let callback: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => {
      callback = next;
      return 17;
    });
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);

    const update = vi.fn();
    const frame = requestPreviewPlaybackFrame(update);
    callback?.(123);

    expect(update).toHaveBeenCalledWith(123);
    frame.cancel();
    expect(cancel).toHaveBeenCalledWith(17);
  });
});
