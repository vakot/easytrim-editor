import { describe, expect, it, vi } from "vitest";

import { cancelPlaybackFrame, requestPlaybackFrame, setPlaybackRateSafely } from "../media-sync";

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

  it("falls back to normal playback when a media element rejects a high rate", () => {
    let playbackRate = 1;
    const media = {
      get playbackRate() {
        return playbackRate;
      },
      set playbackRate(value: number) {
        if (value > 16) throw new DOMException("Unsupported playback rate");
        playbackRate = value;
      },
    } as HTMLMediaElement;

    expect(setPlaybackRateSafely(media, 20)).toBe(1);
    expect(playbackRate).toBe(1);
    expect(setPlaybackRateSafely(media, 4)).toBe(4);
    expect(playbackRate).toBe(4);
  });
});
