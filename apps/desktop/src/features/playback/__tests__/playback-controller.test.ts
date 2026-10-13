import { describe, expect, it, vi } from "vitest";

import { PlaybackController, type PlaybackDriver } from "../playback-controller";

function createPlaybackDriver() {
  let observer: Parameters<PlaybackDriver["video"]["registerMediaObserver"]>[0] | null = null;
  let playbackFrameCallback: Parameters<PlaybackDriver["video"]["requestPlaybackFrame"]>[0] | null =
    null;

  const driver: PlaybackDriver = {
    audio: {
      getCurrentTimeSeconds: vi.fn(() => null),
      hasActiveOutput: true,
      isReady: true,
      pause: vi.fn(),
      resume: vi.fn(async () => undefined),
      seek: vi.fn(),
      setPlaybackRate: vi.fn(),
      startAt: vi.fn(async () => undefined),
    },
    video: {
      getCurrentTimeSeconds: vi.fn(() => 0),
      isReady: true,
      isSeekPending: () => false,
      pause: vi.fn(),
      play: vi.fn(async () => undefined),
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
      seek: vi.fn((_seconds, _approximate, onSettled) => onSettled?.()),
      setCurrentTimeSeconds: vi.fn(),
      setPlaybackRate: vi.fn(),
    },
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createPlaybackController(driver: PlaybackDriver, durationMicros: number) {
  const controller = new PlaybackController();
  controller.attach(1, driver, durationMicros);
  return controller;
}

describe("playback controller", () => {
  it("keeps a single microsecond position and clamps seeks to EOF", () => {
    const { driver } = createPlaybackDriver();
    const controller = createPlaybackController(driver, 2_000_000);

    controller.seek(3_000_000);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isVideoMuted: true,
      isPlaying: false,
      positionMicros: 2_000_000,
    });
    expect(driver.video.seek).toHaveBeenCalledWith(2, false);
    expect(driver.audio.seek).toHaveBeenCalledWith(2);
  });

  it("only marks playback active after the audio and preview participants start", async () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    vi.mocked(driver.audio.getCurrentTimeSeconds).mockReturnValue(1.25);
    const performanceNowSpy = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    expect(controller.getSnapshot().isPlaying).toBe(false);
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));
    playback.playbackFrameCallback(0, 1.25);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isVideoMuted: true,
      isPlaying: true,
      positionMicros: 1_250_000,
    });
    expect(driver.video.setCurrentTimeSeconds).toHaveBeenCalledWith(1.25);
    performanceNowSpy.mockRestore();

    playback.observer.onEnded();

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isVideoMuted: true,
      isPlaying: false,
      positionMicros: 2_000_000,
    });
    expect(driver.video.pause).toHaveBeenCalled();
    expect(driver.audio.pause).toHaveBeenCalled();
    controller.dispose();
  });

  it("keeps playback inactive and pauses both participants when preview startup fails", async () => {
    const { driver } = createPlaybackDriver();
    vi.mocked(driver.video.play).mockRejectedValue(new Error("Video playback failed."));
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.pause).toHaveBeenCalled());

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(driver.video.pause).toHaveBeenCalled();
  });

  it("does not start preview when required audio startup fails", async () => {
    const { driver } = createPlaybackDriver();
    vi.mocked(driver.audio.startAt).mockRejectedValue(new Error("Audio startup failed."));
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.pause).toHaveBeenCalled());

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(driver.video.play).not.toHaveBeenCalled();
    expect(driver.video.pause).toHaveBeenCalled();
  });

  it("does not report playing from a media event before preview startup resolves", async () => {
    const playback = createPlaybackDriver();
    const startPreview = createDeferred<void>();
    vi.mocked(playback.driver.video.play).mockReturnValue(startPreview.promise);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(playback.driver.video.play).toHaveBeenCalled());
    playback.observer.onPlay();

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(playback.driver.video.pause).not.toHaveBeenCalled();

    startPreview.resolve();
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));
  });

  it("ignores startup completion after playback is canceled", async () => {
    const { driver } = createPlaybackDriver();
    const startAudio = createDeferred<void>();
    vi.mocked(driver.audio.startAt).mockReturnValue(startAudio.promise);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.startAt).toHaveBeenCalled());
    controller.pause();
    startAudio.resolve();
    await Promise.resolve();

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(driver.video.play).not.toHaveBeenCalled();
  });

  it("waits for required Web Audio readiness before starting", () => {
    const { driver } = createPlaybackDriver();
    driver.audio.isReady = false;
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();

    expect(driver.audio.resume).not.toHaveBeenCalled();
    expect(controller.getSnapshot().isPlaying).toBe(false);
  });

  it("updates the video mute policy when the audio output changes", () => {
    const { driver } = createPlaybackDriver();
    const controller = createPlaybackController(driver, 2_000_000);
    const updatedDriver = { ...driver, audio: { ...driver.audio, hasActiveOutput: false } };

    controller.attach(1, updatedDriver, 2_000_000);

    expect(controller.getSnapshot().isVideoMuted).toBe(false);
  });

  it("cancels the old startup and disposes its transports when the source session changes", async () => {
    const oldPlayback = createPlaybackDriver();
    const pendingAudioStart = createDeferred<void>();
    vi.mocked(oldPlayback.driver.audio.startAt).mockReturnValue(pendingAudioStart.promise);
    const controller = createPlaybackController(oldPlayback.driver, 2_000_000);

    controller.seek(750_000);
    controller.play();
    await vi.waitFor(() => expect(oldPlayback.driver.audio.startAt).toHaveBeenCalled());

    const oldObserver = oldPlayback.observer;
    const nextPlayback = createPlaybackDriver();
    controller.attach(2, nextPlayback.driver, 3_000_000);
    oldObserver.onEnded();
    pendingAudioStart.resolve();
    await Promise.resolve();

    expect(oldPlayback.driver.video.pause).toHaveBeenCalled();
    expect(oldPlayback.driver.audio.pause).toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({
      durationMicros: 3_000_000,
      isVideoMuted: true,
      isPlaying: false,
      positionMicros: 0,
    });
    expect(nextPlayback.driver.video.play).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("disposes the attached session and ignores pending startup completion", async () => {
    const { driver } = createPlaybackDriver();
    const pendingAudioStart = createDeferred<void>();
    vi.mocked(driver.audio.startAt).mockReturnValue(pendingAudioStart.promise);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.startAt).toHaveBeenCalled());
    controller.dispose();
    pendingAudioStart.resolve();
    await Promise.resolve();

    expect(driver.video.pause).toHaveBeenCalled();
    expect(driver.audio.pause).toHaveBeenCalled();
    expect(driver.video.play).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({
      durationMicros: 0,
      isVideoMuted: false,
      isPlaying: false,
      positionMicros: 0,
    });
  });
});
