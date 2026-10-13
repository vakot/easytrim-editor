import { afterEach, describe, expect, it, vi } from "vitest";

// This test composes Preview's seek scheduler with Playback's controller.
// eslint-disable-next-line no-restricted-imports
import { createPreviewSeekScheduler } from "@/features/preview/lib/preview-seek-scheduler";

import { PlaybackController, type PlaybackDriver } from "../playback-controller";

function createAnimationFrameQueue() {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));

  return () => {
    const scheduled = [...callbacks.values()];
    callbacks.clear();
    for (const callback of scheduled) callback(0);
  };
}

function createNativePreviewHarness() {
  const video = document.createElement("video");
  let currentTime = 0;
  let readyState: number = HTMLMediaElement.HAVE_CURRENT_DATA;
  let seeking = false;
  let paused = true;
  const frameCallbacks = new Set<(timestamp: number, mediaTime: number) => void>();
  const observerCallbacks = new Set<
    Parameters<PlaybackDriver["video"]["registerMediaObserver"]>[0]
  >();

  Object.defineProperties(video, {
    currentTime: {
      get: () => currentTime,
      set: (seconds: number) => {
        currentTime = seconds;
        seeking = true;
        readyState = HTMLMediaElement.HAVE_METADATA;
        video.dispatchEvent(new Event("seeking"));
      },
    },
    paused: { get: () => paused },
    readyState: { get: () => readyState },
    seeking: { get: () => seeking },
  });
  vi.spyOn(video, "play").mockImplementation(async () => {
    if (readyState < HTMLMediaElement.HAVE_CURRENT_DATA || seeking) {
      throw new Error("Video data is not ready.");
    }
    paused = false;
    video.dispatchEvent(new Event("play"));
    video.dispatchEvent(new Event("playing"));
  });
  vi.spyOn(video, "pause").mockImplementation(() => {
    if (paused) return;
    paused = true;
    video.dispatchEvent(new Event("pause"));
  });

  const scheduler = createPreviewSeekScheduler(video);
  const driver: PlaybackDriver = {
    audio: {
      getCurrentTimeSeconds: () => null,
      hasActiveOutput: false,
      isReady: true,
      pause: vi.fn(),
      prepareAt: vi.fn(async () => undefined),
      seek: vi.fn(),
      startAlignedWithVideoAt: vi.fn(async (seconds: number) => seconds),
    },
    video: {
      getCurrentTimeSeconds: () => currentTime,
      isReady: readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      isSeekPending: () => scheduler.isPending,
      pause: () => video.pause(),
      play: () => video.play(),
      registerMediaObserver: (observer) => {
        observerCallbacks.add(observer);
        return () => observerCallbacks.delete(observer);
      },
      requestPlaybackFrame: (callback) => {
        const frameCallback = (timestamp: number, mediaTime: number) =>
          callback(timestamp, mediaTime);

        frameCallbacks.add(frameCallback);
        return {
          cancel: () => frameCallbacks.delete(frameCallback),
        };
      },
      seek: (seconds, approximate, onSettled) => scheduler.seek(seconds, approximate, onSettled),
      setCurrentTimeSeconds: (seconds) => {
        video.currentTime = seconds;
      },
    },
  };

  const controller = new PlaybackController();
  controller.attach(1, driver, 2_000_000);

  return {
    controller,
    driver,
    finishSeek() {
      seeking = false;
      readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
      video.dispatchEvent(new Event("seeked"));
      video.dispatchEvent(new Event("loadeddata"));
    },
    flushAnimationFrames: createAnimationFrameQueue(),
    playNextFrame(mediaTime: number) {
      const [callback] = frameCallbacks;
      if (!callback) throw new Error("No playback frame is pending.");
      frameCallbacks.delete(callback);
      callback(0, mediaTime);
    },
    video,
    notifyNativePause() {
      paused = true;
      video.dispatchEvent(new Event("pause"));
      for (const observer of observerCallbacks) observer.onPause(true);
    },
    dispose() {
      controller.dispose();
      scheduler.dispose();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("native preview playback integration", () => {
  it.each([0, 1, 2])("starts from frame %i without offsetting its timestamp", async (frame) => {
    const preview = createNativePreviewHarness();
    const position = frame / 30;

    preview.controller.seek(position * 1_000_000);
    if (frame > 0) preview.finishSeek();
    preview.controller.play();

    await vi.waitFor(() => {
      expect(preview.video.play).toHaveBeenCalledOnce();
      expect(preview.controller.getSnapshot().isPlaying).toBe(true);
    });

    expect(preview.driver.audio.prepareAt).toHaveBeenCalledWith(position);
    expect(preview.video.currentTime).toBe(position);
    preview.dispose();
  });

  it("keeps the latest scrub target after returning to zero and resumes after native pause", async () => {
    const preview = createNativePreviewHarness();
    preview.controller.seek((2 / 30) * 1_000_000);
    preview.finishSeek();
    preview.controller.play();
    await vi.waitFor(() => expect(preview.controller.getSnapshot().isPlaying).toBe(true));

    preview.controller.seek(0);
    preview.controller.seek((1 / 30) * 1_000_000);
    preview.controller.seek((2 / 30) * 1_000_000);
    preview.flushAnimationFrames();
    preview.notifyNativePause();
    preview.finishSeek();

    expect(preview.controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      positionMicros: (2 / 30) * 1_000_000,
    });
    expect(preview.video.currentTime).toBe(2 / 30);

    preview.controller.play();
    await vi.waitFor(() => expect(preview.controller.getSnapshot().isPlaying).toBe(true));
    preview.playNextFrame(3 / 30);

    expect(preview.controller.getSnapshot().positionMicros).toBe((3 / 30) * 1_000_000);
    expect(preview.video.currentTime).toBe(2 / 30);
    preview.dispose();
  });
});
