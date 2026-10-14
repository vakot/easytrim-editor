import { afterEach, describe, expect, it, vi } from "vitest";

import { requestPreviewPlaybackFrame } from "../preview-frame-scheduler";

afterEach(() => vi.unstubAllGlobals());

describe("preview playback frame scheduling", () => {
  it("samples the native pause clock, even when presented frame timestamps lead it", () => {
    let callback: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => {
      callback = next;
      return 17;
    });
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const video = {
      requestVideoFrameCallback: vi.fn((next: VideoFrameRequestCallback) => {
        next(123, { mediaTime: 0.133333 } as VideoFrameCallbackMetadata);
        return 1;
      }),
      currentTime: 0.125175,
    } as unknown as HTMLVideoElement;

    const update = vi.fn();
    const frame = requestPreviewPlaybackFrame(video, update);
    callback?.(123);

    expect(update).toHaveBeenCalledWith(123, 0.125175);
    expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
    frame.cancel();
    expect(cancel).toHaveBeenCalledWith(17);
  });

  it("continues observing native EOF after the last decoded frame", () => {
    let callback: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (next: FrameRequestCallback) => {
      callback = next;
      return 1;
    });
    const video = { currentTime: 3.983333 } as HTMLVideoElement;
    const update = vi.fn();
    requestPreviewPlaybackFrame(video, update);
    video.currentTime = 4;
    callback?.(456);
    expect(update).toHaveBeenCalledWith(456, 4);
  });
});
