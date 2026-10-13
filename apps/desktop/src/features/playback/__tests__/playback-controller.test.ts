import { describe, expect, it, vi } from "vitest";

import { PlaybackController, type PlaybackDriver } from "../playback-controller";

function createPlaybackDriver() {
  let observer: Parameters<PlaybackDriver["registerMediaObserver"]>[0] | null = null;
  let playbackFrameCallback: Parameters<PlaybackDriver["requestPlaybackFrame"]>[0] | null = null;
  const driver: PlaybackDriver = {
    isPreviewReady: true,
    isSeekPending: () => false,
    pause: vi.fn(),
    pauseMedia: vi.fn(),
    playMedia: vi.fn(async () => undefined),
    registerMediaObserver: vi.fn((nextObserver) => {
      observer = nextObserver;
      return () => {
        observer = null;
      };
    }),
    requestPlaybackFrame: vi.fn((callback) => {
      playbackFrameCallback = callback;
      return { cancel: vi.fn() };
    }),
    resumeAudioContext: vi.fn(async () => undefined),
    seekMedia: vi.fn(),
    setPlaybackRate: vi.fn(),
    startAt: vi.fn(async () => []),
    syncTo: vi.fn(),
  };

  return {
    driver,
    get observer() {
      if (!observer) throw new Error("Playback observer is not connected.");
      return observer;
    },
    get playbackFrameCallback() {
      if (!playbackFrameCallback) throw new Error("Playback clock is not running.");
      return playbackFrameCallback;
    },
  };
}

describe("playback controller", () => {
  it("keeps a single microsecond position and clamps seeks to EOF", () => {
    const { driver } = createPlaybackDriver();
    const controller = new PlaybackController(driver, 2_000_000);

    controller.seek(3_000_000);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isPlaying: false,
      positionMicros: 2_000_000,
    });
    expect(driver.seekMedia).toHaveBeenCalledWith(2, false, expect.any(Function));
  });

  it("uses the media clock and stops at the end of playback", () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    const controller = new PlaybackController(driver, 2_000_000);
    const disconnect = controller.connect();

    playback.observer.onPlay();
    playback.playbackFrameCallback(0, 1.25);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isPlaying: true,
      positionMicros: 1_250_000,
    });
    expect(driver.syncTo).toHaveBeenCalledWith(1.25);

    playback.observer.onEnded();

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isPlaying: false,
      positionMicros: 2_000_000,
    });
    expect(driver.pauseMedia).toHaveBeenCalled();
    expect(driver.pause).toHaveBeenCalled();
    disconnect();
  });
});
