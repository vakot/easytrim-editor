import { afterEach, describe, expect, it, vi } from "vitest";

import { startPreviewPlayback } from "../preview-playback-start";

function createVideo() {
  const video = document.createElement("video");
  let paused = false;
  let ended = false;
  let present: VideoFrameRequestCallback | undefined;
  Object.defineProperties(video, {
    paused: { get: () => paused },
    ended: { get: () => ended },
    duration: { value: 4 },
  });
  vi.spyOn(video, "play").mockResolvedValue();
  video.requestVideoFrameCallback = vi.fn((callback) => {
    present = callback;
    return 7;
  });
  video.cancelVideoFrameCallback = vi.fn();
  return {
    video,
    present(mediaTime: number, expectedDisplayTime: number) {
      present?.(performance.now(), {
        mediaTime,
        expectedDisplayTime,
      } as VideoFrameCallbackMetadata);
    },
    pause() {
      paused = true;
      video.dispatchEvent(new Event("pause"));
    },
    end() {
      ended = true;
      paused = true;
      video.dispatchEvent(new Event("ended"));
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("native video startup presentation", () => {
  it("aligns to the first presented frame instead of the transient native startup clock", async () => {
    const preview = createVideo();
    preview.video.currentTime = 1.48192;
    vi.spyOn(performance, "now").mockReturnValue(1_005);
    const starting = startPreviewPlayback(preview.video);
    await Promise.resolve();
    preview.present(1.466667, 1_000);
    await expect(starting).resolves.toBeCloseTo(1.471667, 6);
    expect(preview.video.currentTime).toBe(1.48192);
    expect(preview.video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
  });

  it("projects the presented frame by the playback rate", async () => {
    const preview = createVideo();
    preview.video.playbackRate = 2;
    vi.spyOn(performance, "now").mockReturnValue(1_005);
    const starting = startPreviewPlayback(preview.video);
    await Promise.resolve();
    preview.present(1.466667, 1_000);
    await expect(starting).resolves.toBeCloseTo(1.476667, 6);
  });

  it.each([0, 1 / 60, 2 / 60])("preserves startup at media time %s", async (seconds) => {
    const preview = createVideo();
    vi.spyOn(performance, "now").mockReturnValue(100);
    const starting = startPreviewPlayback(preview.video);
    await Promise.resolve();
    preview.present(seconds, 100);
    await expect(starting).resolves.toBe(seconds);
  });

  it("cancels a pending presentation on pause and removes its listeners", async () => {
    const preview = createVideo();
    const remove = vi.spyOn(preview.video, "removeEventListener");
    const starting = startPreviewPlayback(preview.video);
    const rejected = expect(starting).rejects.toThrow("interrupted");
    await Promise.resolve();
    preview.pause();
    await rejected;
    expect(remove).toHaveBeenCalledTimes(4);
    expect(preview.video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
  });

  it("finishes very short media even when no further presentation arrives", async () => {
    const preview = createVideo();
    const starting = startPreviewPlayback(preview.video);
    await Promise.resolve();
    preview.end();
    await expect(starting).resolves.toBe(4);
  });

  it("ignores a delayed pause event when the native element is already playing", async () => {
    const preview = createVideo();
    vi.spyOn(performance, "now").mockReturnValue(100);
    const starting = startPreviewPlayback(preview.video);
    await Promise.resolve();
    preview.video.dispatchEvent(new Event("pause"));
    preview.present(0.5, 100);
    await expect(starting).resolves.toBe(0.5);
  });
});
