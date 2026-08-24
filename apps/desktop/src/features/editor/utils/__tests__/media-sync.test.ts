import { describe, expect, it, vi } from "vitest";

import { cancelPlaybackFrame, requestPlaybackFrame } from "../media-sync";

describe("playback frame scheduling", () => {
  it("uses presented video frames and their media timestamps when available", () => {
    let callback: VideoFrameRequestCallback | undefined;
    const cancelVideoFrameCallback = vi.fn();
    const video = {
      requestVideoFrameCallback: vi.fn((next: VideoFrameRequestCallback) => {
        callback = next;
        return 17;
      }),
      cancelVideoFrameCallback,
      currentTime: 99,
    } as unknown as HTMLVideoElement;
    const update = vi.fn();
    const frameRef = { current: requestPlaybackFrame(video, update) };

    callback?.(123, { mediaTime: 4.25 } as VideoFrameCallbackMetadata);

    expect(update).toHaveBeenCalledWith(123, 4.25);
    cancelPlaybackFrame(frameRef);
    expect(cancelVideoFrameCallback).toHaveBeenCalledWith(17);
    expect(frameRef.current).toBeNull();
  });
});
