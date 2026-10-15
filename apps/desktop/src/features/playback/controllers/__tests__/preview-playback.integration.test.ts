import { afterEach, describe, expect, it, vi } from "vitest";

import { createNominalFrameIndex } from "@/domain/frame-index";
import type { FrameRate } from "@/domain/media";
import { frameToMicros } from "@/domain/media-time";
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createNativePreviewHarness(durationMicros = 2_000_000, hasAudioOutput = false) {
  const video = document.createElement("video");
  let currentTime = 0;
  let readyState: number = HTMLMediaElement.HAVE_CURRENT_DATA;
  let seeking = false;
  let paused = true;
  let ended = false;
  let audioPosition: number | null = null;
  const frameCallbacks = new Set<(timestamp: number, mediaTime: number) => void>();
  const observerCallbacks = new Set<
    Parameters<PlaybackDriver["video"]["registerMediaObserver"]>[0]
  >();

  Object.defineProperties(video, {
    currentTime: {
      get: () => currentTime,
      set: (seconds: number) => {
        currentTime = seconds;
        ended = false;
        seeking = true;
        readyState = HTMLMediaElement.HAVE_METADATA;
        video.dispatchEvent(new Event("seeking"));
      },
    },
    paused: { get: () => paused },
    ended: { get: () => ended },
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
      getCurrentTimeSeconds: () => audioPosition,
      hasActiveOutput: hasAudioOutput,
      isReady: true,
      pause: vi.fn(),
      prefetchAt: vi.fn(),
      prepareAt: vi.fn(async () => undefined),
      registerPlaybackErrorObserver: () => () => undefined,
      seek: vi.fn(),
      startAlignedWithVideoAt: vi.fn(async (seconds: number) => seconds),
    },
    video: {
      getCurrentTimeSeconds: () => currentTime,
      getPresentedTimeSeconds: () => currentTime,
      isEnded: () => ended,
      isReady: readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      isSeekPending: () => scheduler.isPending,
      pause: () => video.pause(),
      play: async () => {
        await video.play();
        return video.currentTime;
      },
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
    },
  };

  const controller = new PlaybackController();
  controller.attach(1, driver, durationMicros);

  return {
    controller,
    driver,
    finishSeek() {
      seeking = false;
      readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
      video.dispatchEvent(new Event("seeked"));
      video.dispatchEvent(new Event("loadeddata"));
    },
    get pendingPlaybackFrameCount() {
      return frameCallbacks.size;
    },
    advanceMediaTime(seconds: number) {
      currentTime = seconds;
      for (const observer of observerCallbacks) observer.onTimeUpdate(seconds);
    },
    setAudioPosition(seconds: number | null) {
      audioPosition = seconds;
    },
    flushAnimationFrames: createAnimationFrameQueue(),
    playNextFrame(mediaTime: number) {
      const callbacks = [...frameCallbacks];
      if (callbacks.length === 0) throw new Error("No playback frame is pending.");
      for (const callback of callbacks) {
        frameCallbacks.delete(callback);
        callback(0, mediaTime);
      }
    },
    video,
    notifyNativePause() {
      paused = true;
      video.dispatchEvent(new Event("pause"));
      for (const observer of observerCallbacks) observer.onPause(true);
    },
    setNativeEnded(value: boolean) {
      ended = value;
    },
    notifyNativeEnded() {
      for (const observer of observerCallbacks) observer.onEnded();
    },
    dispose() {
      controller.dispose();
      scheduler.dispose();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("native preview playback integration", () => {
  it.each([30, 60])(
    "pauses and resumes at the frozen native position across repeated cycles at %i FPS",
    async (frameRate) => {
      const preview = createNativePreviewHarness(1_000_000, true);
      let resumePosition = 0;

      for (let cycle = 1; cycle <= 3; cycle += 1) {
        preview.controller.play();
        await vi.waitFor(() => expect(preview.controller.isPlaying).toBe(true));
        expect(preview.driver.audio.prepareAt).toHaveBeenLastCalledWith(resumePosition);

        const pausedPosition = (cycle * 3) / frameRate;
        preview.setAudioPosition(pausedPosition - 0.05);
        preview.advanceMediaTime(pausedPosition);
        preview.playNextFrame(pausedPosition);
        preview.controller.togglePlayback();

        expect(preview.controller.isPlaying).toBe(false);
        expect(preview.video.currentTime).toBe(pausedPosition);
        expect(preview.controller.getSnapshot().positionMicros).toBe(pausedPosition * 1_000_000);
        expect(preview.driver.audio.seek).toHaveBeenLastCalledWith(pausedPosition);
        resumePosition = pausedPosition;
      }

      preview.dispose();
    },
  );

  it("updates the Timeline from video frames while audio startup is pending", async () => {
    const preview = createNativePreviewHarness();
    const pendingAudioStart = createDeferred<number>();
    vi.mocked(preview.driver.audio.startAlignedWithVideoAt).mockReturnValue(
      pendingAudioStart.promise,
    );

    preview.controller.play();
    await vi.waitFor(() =>
      expect(preview.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledOnce(),
    );

    expect(preview.controller.getSnapshot()).toMatchObject({
      positionMicros: 0,
    });
    preview.playNextFrame(0.05);

    expect(preview.controller.getSnapshot()).toMatchObject({
      positionMicros: 50_000,
    });

    pendingAudioStart.resolve(0.05);
    await Promise.resolve();
    expect(preview.controller.isPlaying).toBe(true);
    preview.dispose();
  });

  it("stops startup frame updates when a seek supersedes pending audio startup", async () => {
    const preview = createNativePreviewHarness();
    const pendingAudioStart = createDeferred<number>();
    vi.mocked(preview.driver.audio.startAlignedWithVideoAt).mockReturnValue(
      pendingAudioStart.promise,
    );

    preview.controller.play();
    await vi.waitFor(() =>
      expect(preview.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledOnce(),
    );
    preview.playNextFrame(0.05);

    preview.controller.seek(200_000);
    preview.finishSeek();
    pendingAudioStart.resolve(0.15);
    await Promise.resolve();

    expect(preview.controller.getSnapshot()).toMatchObject({
      positionMicros: 200_000,
    });
    expect(preview.video.paused).toBe(true);
    expect(preview.pendingPlaybackFrameCount).toBe(0);
    preview.dispose();
  });

  it.each([
    ["30 fps", { numerator: 30, denominator: 1 }],
    ["60 fps", { numerator: 60, denominator: 1 }],
    ["24000/1001 fps", { numerator: 24_000, denominator: 1_001 }],
    ["30000/1001 fps", { numerator: 30_000, denominator: 1_001 }],
  ] as [string, FrameRate][])(
    "preserves the final presented frame and finalizes EOF from native ended state for %s with and without audio",
    async (_label, frameRate) => {
      for (const hasAudioOutput of [false, true]) {
        const frameCount = 3;
        const durationMicros = Math.round(
          (frameCount * 1_000_000 * frameRate.denominator) / frameRate.numerator,
        );

        const durationSeconds = durationMicros / 1_000_000;
        const lastAudioPosition = durationSeconds - 1 / 48_000;
        const lastFrameMicros = frameToMicros(frameCount - 1, frameRate);
        const lastFrameSeconds = lastFrameMicros / 1_000_000;
        const preview = createNativePreviewHarness(durationMicros, hasAudioOutput);

        if (hasAudioOutput) {
          vi.spyOn(preview.driver.audio, "startAlignedWithVideoAt").mockImplementation(
            async (videoPosition) => {
              const audioStart = Math.min(videoPosition + 0.15, lastAudioPosition);
              preview.setAudioPosition(audioStart);
              return audioStart;
            },
          );
        }

        preview.controller.play();
        await vi.waitFor(() => expect(preview.video.play).toHaveBeenCalled());
        if (hasAudioOutput) {
          await vi.waitFor(() =>
            expect(preview.driver.audio.startAlignedWithVideoAt).toHaveBeenCalled(),
          );
          preview.advanceMediaTime(Math.min(0.15, lastAudioPosition));
        }
        preview.playNextFrame(lastFrameSeconds);
        await vi.waitFor(() => expect(preview.controller.isPlaying).toBe(true));

        if (hasAudioOutput) preview.setAudioPosition(durationSeconds);
        preview.advanceMediaTime(durationSeconds);
        preview.playNextFrame(lastFrameSeconds);

        expect(preview.controller.isPlaying).toBe(true);
        expect(
          createNominalFrameIndex(durationMicros, frameRate).frameAt(
            preview.controller.getSnapshot().positionMicros,
          ),
        ).toBe(frameCount - 1);
        expect(preview.controller.getSnapshot().positionMicros).toBeLessThan(durationMicros);

        preview.controller.pause();
        expect(preview.controller.getSnapshot()).toMatchObject({
          positionMicros: lastFrameMicros,
        });

        preview.controller.play();
        await vi.waitFor(() =>
          expect(preview.driver.audio.prepareAt).toHaveBeenLastCalledWith(lastFrameSeconds),
        );
        preview.finishSeek();
        if (hasAudioOutput) {
          await vi.waitFor(() =>
            expect(preview.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledTimes(2),
          );
          preview.advanceMediaTime(lastAudioPosition);
          preview.playNextFrame(lastFrameSeconds);
        }
        await vi.waitFor(() => expect(preview.controller.isPlaying).toBe(true));
        preview.setNativeEnded(true);
        preview.notifyNativePause();

        expect(preview.controller.getSnapshot()).toEqual({
          durationMicros,
          positionMicros: durationMicros,
        });

        preview.controller.play();
        await vi.waitFor(() => expect(preview.driver.audio.prepareAt).toHaveBeenLastCalledWith(0));
        preview.flushAnimationFrames();
        preview.finishSeek();
        await vi.waitFor(() => {
          expect(preview.video.currentTime).toBe(0);
          expect(preview.video.play).toHaveBeenCalledTimes(3);
        });
        preview.dispose();
      }
    },
  );

  it("does not treat a manual pause just before EOF as natural completion", async () => {
    const preview = createNativePreviewHarness(1_000_000);
    const pausePosition = 0.999;

    preview.controller.play();
    await vi.waitFor(() => expect(preview.controller.isPlaying).toBe(true));
    preview.advanceMediaTime(pausePosition);
    preview.playNextFrame(pausePosition);
    preview.controller.pause();

    expect(preview.controller.isPlaying).toBe(false);
    expect(preview.controller.getSnapshot().positionMicros).toBe(999_000);

    preview.dispose();
  });

  it.each([0, 1, 2])("starts from frame %i without offsetting its timestamp", async (frame) => {
    const preview = createNativePreviewHarness();
    const position = Math.round((frame / 30) * 1_000_000) / 1_000_000;

    preview.controller.seek(position * 1_000_000);
    if (frame > 0) preview.finishSeek();
    preview.controller.play();

    await vi.waitFor(() => {
      expect(preview.video.play).toHaveBeenCalledOnce();
      expect(preview.controller.isPlaying).toBe(true);
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
    await vi.waitFor(() => expect(preview.controller.isPlaying).toBe(true));

    preview.controller.seek(0);
    preview.controller.seek((1 / 30) * 1_000_000);
    preview.controller.seek((2 / 30) * 1_000_000);
    preview.flushAnimationFrames();
    preview.notifyNativePause();
    preview.finishSeek();

    expect(preview.controller.getSnapshot()).toMatchObject({
      positionMicros: Math.round((2 / 30) * 1_000_000),
    });
    expect(preview.video.currentTime).toBe(0.066667);

    preview.controller.play();
    await vi.waitFor(() => expect(preview.controller.isPlaying).toBe(true));
    preview.playNextFrame(3 / 30);

    expect(preview.controller.getSnapshot().positionMicros).toBe((3 / 30) * 1_000_000);
    expect(preview.video.currentTime).toBe(0.066667);
    preview.dispose();
  });
});
