import { describe, expect, it, vi } from "vitest";

import { PlaybackController, type PlaybackDriver } from "../playback-controller";

function createPlaybackDriver() {
  let observer: Parameters<PlaybackDriver["video"]["registerMediaObserver"]>[0] | null = null;
  let audioPlaybackErrorObserver: (() => void) | null = null;
  const playbackFrameCallbacks = new Map<
    number,
    Parameters<PlaybackDriver["video"]["requestPlaybackFrame"]>[0]
  >();

  let nextPlaybackFrameId = 0;

  const driver: PlaybackDriver = {
    audio: {
      getCurrentTimeSeconds: vi.fn(() => null),
      hasActiveOutput: true,
      isReady: true,
      pause: vi.fn(),
      prepareAt: vi.fn(async () => undefined),
      registerPlaybackErrorObserver: vi.fn((nextObserver) => {
        audioPlaybackErrorObserver = nextObserver;
        return () => {
          if (audioPlaybackErrorObserver === nextObserver) audioPlaybackErrorObserver = null;
        };
      }),
      seek: vi.fn(),
      startAlignedWithVideoAt: vi.fn(async (seconds: number) => seconds + 0.15),
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
        const frameId = nextPlaybackFrameId++;
        playbackFrameCallbacks.set(frameId, callback);
        return { cancel: () => playbackFrameCallbacks.delete(frameId) };
      }),
      seek: vi.fn((_seconds, _approximate, onSettled) => onSettled?.()),
      setCurrentTimeSeconds: vi.fn(),
    },
  };

  return {
    driver,
    get observer() {
      if (!observer) throw new Error("Playback observer is not connected.");
      return observer;
    },
    notifyAudioPlaybackError() {
      if (!audioPlaybackErrorObserver) throw new Error("Audio error observer is not connected.");
      audioPlaybackErrorObserver();
    },
    get playbackFrameCallback() {
      if (playbackFrameCallbacks.size === 0) throw new Error("Playback clock is not running.");
      const callbacks = [...playbackFrameCallbacks.entries()];
      return (timestamp: number, seconds: number) => {
        for (const [frameId, callback] of callbacks) {
          playbackFrameCallbacks.delete(frameId);
          callback(timestamp, seconds);
        }
      };
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
      isPlaying: false,
      positionMicros: 2_000_000,
    });
    expect(driver.video.seek).toHaveBeenCalledWith(2, false, expect.any(Function));
    expect(driver.audio.seek).toHaveBeenCalledWith(2);
  });

  it("only marks playback active after the audio and preview participants start", async () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    vi.mocked(driver.audio.getCurrentTimeSeconds).mockReturnValue(1.4);
    vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(1.25);
    const performanceNowSpy = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    expect(controller.getSnapshot().isPlaying).toBe(false);
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(1.25));
    expect(controller.getSnapshot().isPlaying).toBe(false);
    playback.playbackFrameCallback(0, 1.4);
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));
    playback.playbackFrameCallback(0, 1.4);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isPlaying: true,
      positionMicros: 1_400_000,
    });
    expect(driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(1.25);
    performanceNowSpy.mockRestore();

    playback.observer.onEnded();

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isPlaying: false,
      positionMicros: 2_000_000,
    });
    expect(driver.video.pause).toHaveBeenCalled();
    expect(driver.audio.pause).toHaveBeenCalled();
    controller.dispose();
  });

  it("starts the initial playback session at timestamp zero", async () => {
    const { driver } = createPlaybackDriver();
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));

    expect(driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(driver.video.seek).toHaveBeenCalledWith(0, false, expect.any(Function));
    expect(driver.video.play).toHaveBeenCalledOnce();
    expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(0);
    controller.dispose();
  });

  it("restarts at timestamp zero after seeking back to the beginning", async () => {
    const { driver } = createPlaybackDriver();
    const controller = createPlaybackController(driver, 2_000_000);

    controller.seek(700_000);
    controller.seek(0);
    controller.play();
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));

    expect(driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(driver.video.seek).toHaveBeenLastCalledWith(0, false, expect.any(Function));
    expect(controller.getSnapshot().positionMicros).toBe(0);
    controller.dispose();
  });

  it("restarts from timestamp zero after reaching EOF", async () => {
    const playback = createPlaybackDriver();
    const controller = createPlaybackController(playback.driver, 2_000_000);

    playback.observer.onEnded();
    controller.play();
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));

    expect(controller.getSnapshot().positionMicros).toBe(0);
    expect(playback.driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(playback.driver.video.seek).toHaveBeenLastCalledWith(0, false, expect.any(Function));
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

  it("pauses native preview when audio scheduling fails", async () => {
    const { driver } = createPlaybackDriver();
    vi.mocked(driver.audio.startAlignedWithVideoAt).mockRejectedValue(
      new Error("Audio startup failed."),
    );
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.pause).toHaveBeenCalled());

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(driver.video.play).toHaveBeenCalled();
    expect(driver.video.pause).toHaveBeenCalled();
  });

  it("pauses both transports when active audio reports a later playback failure", async () => {
    const playback = createPlaybackDriver();
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));

    playback.notifyAudioPlaybackError();

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(playback.driver.audio.pause).toHaveBeenCalled();
    expect(playback.driver.video.pause).toHaveBeenCalled();
    controller.dispose();
  });

  it("waits for native video startup before scheduling audio against its future position", async () => {
    const playback = createPlaybackDriver();
    const startVideo = createDeferred<void>();
    vi.mocked(playback.driver.video.play).mockReturnValue(startVideo.promise);
    vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(0.4);
    vi.mocked(playback.driver.audio.getCurrentTimeSeconds).mockReturnValue(0.4);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(playback.driver.video.play).toHaveBeenCalled());

    expect(playback.driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(playback.driver.audio.startAlignedWithVideoAt).not.toHaveBeenCalled();
    expect(controller.getSnapshot().isPlaying).toBe(false);

    startVideo.resolve();
    await vi.waitFor(() =>
      expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(0.4),
    );
    expect(controller.getSnapshot().isPlaying).toBe(false);
    playback.playbackFrameCallback(0, 0.55);
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));
  });

  it.each([
    { durationMicros: 1_000_000, positionMicros: 900_000 },
    { durationMicros: 100_000, positionMicros: 0 },
  ])(
    "bounds the shared startup position to EOF for a $durationMicros microsecond media range",
    async ({ durationMicros, positionMicros }) => {
      const playback = createPlaybackDriver();
      const startSeconds = positionMicros / 1_000_000;
      const durationSeconds = durationMicros / 1_000_000;
      vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(startSeconds);
      vi.mocked(playback.driver.audio.getCurrentTimeSeconds).mockReturnValue(startSeconds);
      vi.mocked(playback.driver.audio.startAlignedWithVideoAt).mockImplementation(async (seconds) =>
        Math.min(seconds + 0.15, durationSeconds - 1 / 48_000),
      );
      const controller = createPlaybackController(playback.driver, durationMicros);

      controller.seek(positionMicros);
      controller.play();

      await vi.waitFor(() =>
        expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(startSeconds),
      );
      const sharedStartSeconds = Math.min(startSeconds + 0.15, durationSeconds - 1 / 48_000);
      playback.playbackFrameCallback(0, sharedStartSeconds);
      await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));

      expect(playback.driver.audio.prepareAt).toHaveBeenLastCalledWith(startSeconds);
      expect(controller.getSnapshot().positionMicros).toBeCloseTo(sharedStartSeconds * 1_000_000);
      controller.dispose();
    },
  );

  it("cancels the shared-start wait when playback is paused", async () => {
    const playback = createPlaybackDriver();
    vi.mocked(playback.driver.audio.getCurrentTimeSeconds).mockReturnValue(0.4);
    vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(0.4);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() =>
      expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalled(),
    );
    const pendingFrame = playback.playbackFrameCallback;

    controller.pause();
    pendingFrame(0, 0.55);

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(playback.driver.video.pause).toHaveBeenCalled();
    expect(playback.driver.audio.pause).toHaveBeenCalled();
  });

  it("freezes the last published playback position on pause and ignores stale video updates", async () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    let audioPosition = 1.4;
    vi.mocked(driver.audio.getCurrentTimeSeconds).mockImplementation(() => audioPosition);
    vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(1.25);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalled());
    playback.playbackFrameCallback(0, 1.4);
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));

    audioPosition = 1.52;
    vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(1.5);
    const staleFrame = playback.playbackFrameCallback;
    controller.pause();
    staleFrame(0, 1.6);
    playback.observer.onTimeUpdate(1.48);

    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      positionMicros: 1_400_000,
    });
    expect(vi.mocked(driver.audio.pause).mock.invocationCallOrder.at(-1)).toBeLessThan(
      vi.mocked(driver.video.pause).mock.invocationCallOrder.at(-1) ?? Infinity,
    );
    controller.dispose();
  });

  it("captures the video position when pausing during startup", async () => {
    const playback = createPlaybackDriver();
    const startAudio = createDeferred<number>();
    vi.mocked(playback.driver.audio.getCurrentTimeSeconds).mockReturnValue(0.9);
    vi.mocked(playback.driver.audio.startAlignedWithVideoAt).mockReturnValue(startAudio.promise);
    vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(0.25);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() =>
      expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalled(),
    );
    playback.playbackFrameCallback(0, 0.25);
    controller.pause();
    startAudio.resolve(1.05);
    await Promise.resolve();
    playback.observer.onTimeUpdate(0.2);

    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      positionMicros: 250_000,
    });
    expect(playback.driver.video.pause).toHaveBeenCalled();
    expect(playback.driver.audio.pause).toHaveBeenCalled();
    controller.dispose();
  });

  it("preserves the scrub target when pause and delayed timeupdate follow the seek", () => {
    const playback = createPlaybackDriver();
    vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(0.2);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.seek(800_000);
    controller.pause();
    playback.observer.onTimeUpdate(0.2);

    expect(controller.getSnapshot()).toMatchObject({
      isPlaying: false,
      positionMicros: 800_000,
    });
    controller.dispose();
  });

  it("can resume after a scrub invalidates pending playback startup", async () => {
    const { driver } = createPlaybackDriver();
    const pendingPreparation = createDeferred<void>();
    vi.mocked(driver.audio.prepareAt).mockImplementationOnce(() => pendingPreparation.promise);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.prepareAt).toHaveBeenCalledTimes(1));
    controller.seek(800_000);
    controller.play();

    await vi.waitFor(() => expect(driver.audio.prepareAt).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(driver.video.play).toHaveBeenCalledTimes(1));
    pendingPreparation.resolve();
    await Promise.resolve();

    expect(driver.video.seek).toHaveBeenLastCalledWith(0.8, false, expect.any(Function));
    expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("invalidates an old playback frame while rapid seeks are pending", async () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    const seekCallbacks: Array<(() => void) | undefined> = [];
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));
    const stalePlaybackFrame = playback.playbackFrameCallback;
    vi.mocked(driver.video.seek).mockImplementation((_seconds, _approximate, onSettled) => {
      seekCallbacks.push(onSettled);
    });

    controller.seek(500_000);
    controller.seek(750_000);
    stalePlaybackFrame(0, 1.5);

    expect(controller.getSnapshot().positionMicros).toBe(750_000);
    expect(driver.video.setCurrentTimeSeconds).not.toHaveBeenCalled();

    seekCallbacks[0]?.();
    expect(controller.getSnapshot().isPlaying).toBe(true);
    seekCallbacks[1]?.();
    playback.playbackFrameCallback(0, 0.8);

    expect(controller.getSnapshot().positionMicros).toBe(800_000);
    expect(driver.video.setCurrentTimeSeconds).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("keeps playback active when a delayed pause event follows rapid scrubbing and resume", async () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledTimes(1));
    playback.playbackFrameCallback(0, 0.15);
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));

    controller.seek(1_200_000);
    controller.seek(400_000);
    controller.seek(1_000_000);
    controller.seek(550_000);
    vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(0.55);
    vi.mocked(driver.audio.getCurrentTimeSeconds).mockReturnValue(0.55);
    playback.observer.onPause(true);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isPlaying: false,
      positionMicros: 550_000,
    });
    expect(driver.audio.pause).toHaveBeenCalled();

    controller.play();
    await vi.waitFor(() => expect(driver.audio.prepareAt).toHaveBeenLastCalledWith(0.55));
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledTimes(2));
    playback.playbackFrameCallback(0, 0.8);
    await vi.waitFor(() => expect(controller.getSnapshot().isPlaying).toBe(true));

    expect(driver.video.seek).toHaveBeenLastCalledWith(0.55, false, expect.any(Function));
    expect(controller.getSnapshot().positionMicros).toBe(800_000);

    const audioPauseCount = vi.mocked(driver.audio.pause).mock.calls.length;
    playback.observer.onPause(false);

    expect(controller.getSnapshot().isPlaying).toBe(true);
    expect(driver.audio.pause).toHaveBeenCalledTimes(audioPauseCount);
    controller.dispose();
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
    const startAudio = createDeferred<number>();
    vi.mocked(driver.audio.startAlignedWithVideoAt).mockReturnValue(startAudio.promise);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalled());
    controller.pause();
    startAudio.resolve(0.55);
    await Promise.resolve();

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(driver.video.play).toHaveBeenCalled();
  });

  it("waits for required Web Audio readiness before starting", () => {
    const { driver } = createPlaybackDriver();
    driver.audio.isReady = false;
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();

    expect(driver.audio.prepareAt).not.toHaveBeenCalled();
    expect(controller.getSnapshot().isPlaying).toBe(false);
  });

  it("keeps video mute policy out of the shared playback snapshot", () => {
    const { driver } = createPlaybackDriver();
    const controller = createPlaybackController(driver, 2_000_000);
    const updatedDriver = { ...driver, audio: { ...driver.audio, hasActiveOutput: false } };

    controller.attach(1, updatedDriver, 2_000_000);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      isPlaying: false,
      positionMicros: 0,
    });
  });

  it("cancels the old startup and disposes its transports when the source session changes", async () => {
    const oldPlayback = createPlaybackDriver();
    const pendingAudioStart = createDeferred<number>();
    vi.mocked(oldPlayback.driver.audio.startAlignedWithVideoAt).mockReturnValue(
      pendingAudioStart.promise,
    );
    const controller = createPlaybackController(oldPlayback.driver, 2_000_000);

    controller.seek(750_000);
    controller.play();
    await vi.waitFor(() =>
      expect(oldPlayback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalled(),
    );

    const oldObserver = oldPlayback.observer;
    const nextPlayback = createPlaybackDriver();
    controller.attach(2, nextPlayback.driver, 3_000_000);
    oldObserver.onEnded();
    pendingAudioStart.resolve(0.9);
    await Promise.resolve();

    expect(oldPlayback.driver.video.pause).toHaveBeenCalled();
    expect(oldPlayback.driver.audio.pause).toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({
      durationMicros: 3_000_000,
      isPlaying: false,
      positionMicros: 0,
    });
    expect(nextPlayback.driver.video.play).not.toHaveBeenCalled();
    controller.dispose();
  });

  it("disposes the attached session and ignores pending startup completion", async () => {
    const { driver } = createPlaybackDriver();
    const pendingAudioStart = createDeferred<number>();
    vi.mocked(driver.audio.startAlignedWithVideoAt).mockReturnValue(pendingAudioStart.promise);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalled());
    controller.dispose();
    pendingAudioStart.resolve(0.15);
    await Promise.resolve();

    expect(driver.video.pause).toHaveBeenCalled();
    expect(driver.audio.pause).toHaveBeenCalled();
    expect(driver.video.play).toHaveBeenCalled();
    expect(controller.getSnapshot()).toEqual({
      durationMicros: 0,
      isPlaying: false,
      positionMicros: 0,
    });
  });
});
