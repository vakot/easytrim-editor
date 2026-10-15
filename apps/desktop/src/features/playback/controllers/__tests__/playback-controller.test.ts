import { describe, expect, it, vi } from "vitest";

import { createNominalFrameIndex } from "@/domain/frame-index";

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
      getMeter: () => null,
      hasActiveOutput: true,
      isReady: true,
      pause: vi.fn(),
      prefetchAt: vi.fn(),
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
      isEnded: vi.fn(() => false),
      isReady: true,
      isSeekPending: vi.fn(() => false),
      pause: vi.fn(),
      play: vi.fn(async () => {
        observer?.onPlay();
        return driver.video.getCurrentTimeSeconds() ?? 0;
      }),
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
      // A display refresh at `timestamp`, with the media clock at `seconds`.
      return (timestamp: number, seconds: number) => {
        vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(seconds);
        for (const [frameId, callback] of callbacks) {
          playbackFrameCallbacks.delete(frameId);
          callback(timestamp);
        }
      };
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createPlaybackController(driver: PlaybackDriver, durationMicros: number) {
  const controller = new PlaybackController();
  controller.attach(1, driver, durationMicros);
  return controller;
}

describe("playback controller", () => {
  it("aligns audio to the startup presentation anchor instead of transient native currentTime", async () => {
    const playback = createPlaybackDriver();
    vi.mocked(playback.driver.video.play).mockImplementation(async () => {
      playback.observer.onPlay();
      return 1.471667;
    });
    vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(1.48192);
    const controller = createPlaybackController(playback.driver, 4_000_000);
    controller.seek(1_463_062);
    controller.play();
    await vi.waitFor(() =>
      expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(1.471667),
    );
    expect(controller.isPlaying).toBe(true);
    controller.dispose();
  });

  it("does not retain an old frame request when a subscriber pauses during publication", async () => {
    const playback = createPlaybackDriver();
    const controller = createPlaybackController(playback.driver, 4_000_000);
    controller.play();
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
    const unsubscribe = controller.subscribe(() => {
      if (controller.isPlaying) controller.pause();
    });

    playback.playbackFrameCallback(0, 0.2);
    unsubscribe();
    expect(controller.isPlaying).toBe(false);
    controller.play();
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
    playback.playbackFrameCallback(0, 0.3);
    expect(controller.getSnapshot().positionMicros).toBe(300_000);
    controller.dispose();
  });

  it("keeps a single microsecond position and clamps seeks to EOF", () => {
    const { driver } = createPlaybackDriver();
    const controller = createPlaybackController(driver, 2_000_000);

    controller.seek(3_000_000);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      positionMicros: 2_000_000,
    });
    expect(driver.video.seek).toHaveBeenCalledWith(2, false);
    expect(driver.audio.seek).toHaveBeenCalledWith(2);
  });

  it("marks playback active when native video starts, while audio synchronization continues", async () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    vi.mocked(driver.audio.getCurrentTimeSeconds).mockReturnValue(1.4);
    vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(1.25);
    const performanceNowSpy = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    expect(controller.isPlaying).toBe(false);
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(1.25));
    expect(controller.isPlaying).toBe(true);
    playback.playbackFrameCallback(0, 1.4);
    playback.playbackFrameCallback(0, 1.4);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      positionMicros: 1_400_000,
    });
    expect(driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(1.25);
    performanceNowSpy.mockRestore();

    vi.mocked(driver.video.isEnded).mockReturnValue(true);
    playback.observer.onEnded();

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
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
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

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
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

    expect(driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(driver.video.seek).toHaveBeenLastCalledWith(0, false, expect.any(Function));
    expect(controller.getSnapshot().positionMicros).toBe(0);
    controller.dispose();
  });

  it("restarts from timestamp zero after reaching EOF", async () => {
    const playback = createPlaybackDriver();
    const controller = createPlaybackController(playback.driver, 2_000_000);
    let videoSeconds = 0;
    vi.mocked(playback.driver.video.isEnded).mockImplementation(() => videoSeconds >= 2);
    vi.mocked(playback.driver.video.seek).mockImplementation((seconds, _approximate, onSettled) => {
      videoSeconds = seconds;
      onSettled?.();
    });

    controller.play();
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
    videoSeconds = 2;
    playback.observer.onEnded();
    expect(controller.isPlaying).toBe(false);
    expect(controller.getSnapshot().positionMicros).toBe(2_000_000);

    controller.play();
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

    expect(controller.getSnapshot().positionMicros).toBe(0);
    expect(playback.driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(playback.driver.video.seek).toHaveBeenLastCalledWith(0, false, expect.any(Function));
    controller.dispose();
  });

  it("ignores a delayed ended event after the native video has moved away from EOF", () => {
    const playback = createPlaybackDriver();
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.seek(700_000);
    playback.observer.onEnded();

    expect(controller.getSnapshot().positionMicros).toBe(700_000);

    controller.dispose();
  });

  it("keeps playback inactive and pauses both participants when preview startup fails", async () => {
    const { driver } = createPlaybackDriver();
    vi.mocked(driver.video.play).mockRejectedValue(new Error("Video playback failed."));
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.pause).toHaveBeenCalled());

    expect(controller.isPlaying).toBe(false);
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

    expect(controller.isPlaying).toBe(false);
    expect(driver.video.play).toHaveBeenCalled();
    expect(driver.video.pause).toHaveBeenCalled();
  });

  it("pauses both transports when active audio reports a later playback failure", async () => {
    const playback = createPlaybackDriver();
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

    playback.notifyAudioPlaybackError();

    expect(controller.isPlaying).toBe(false);
    expect(playback.driver.audio.pause).toHaveBeenCalled();
    expect(playback.driver.video.pause).toHaveBeenCalled();
    controller.dispose();
  });

  it("waits for native video startup before scheduling audio against its future position", async () => {
    const playback = createPlaybackDriver();
    const startVideo = createDeferred<number>();
    vi.mocked(playback.driver.video.play).mockReturnValue(startVideo.promise);
    vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(0.4);
    vi.mocked(playback.driver.audio.getCurrentTimeSeconds).mockReturnValue(0.4);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(playback.driver.video.play).toHaveBeenCalled());

    expect(playback.driver.audio.prepareAt).toHaveBeenCalledWith(0);
    expect(playback.driver.audio.startAlignedWithVideoAt).not.toHaveBeenCalled();
    expect(controller.isPlaying).toBe(false);

    startVideo.resolve(0.4);
    await vi.waitFor(() =>
      expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledWith(0.4),
    );
    expect(controller.isPlaying).toBe(true);
    playback.playbackFrameCallback(0, 0.55);
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
      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

      expect(playback.driver.audio.prepareAt).toHaveBeenLastCalledWith(startSeconds);
      expect(controller.getSnapshot().positionMicros).toBe(
        Math.round(sharedStartSeconds * 1_000_000),
      );
      controller.dispose();
    },
  );

  it("invalidates pending frame updates when playback is paused", async () => {
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

    expect(controller.isPlaying).toBe(false);
    expect(playback.driver.video.pause).toHaveBeenCalled();
    expect(playback.driver.audio.pause).toHaveBeenCalled();
  });

  it("captures the native pause position and aligns audio before freezing stale updates", async () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    let audioPosition = 1.4;
    vi.mocked(driver.audio.getCurrentTimeSeconds).mockImplementation(() => audioPosition);
    vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(1.25);
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalled());
    playback.playbackFrameCallback(0, 1.4);
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

    audioPosition = 1.52;
    vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(1.5);
    const staleFrame = playback.playbackFrameCallback;
    controller.pause();
    staleFrame(0, 1.6);
    playback.observer.onTimeUpdate(1.48);

    expect(controller.getSnapshot()).toMatchObject({
      positionMicros: 1_500_000,
    });
    expect(driver.audio.seek).toHaveBeenLastCalledWith(1.5);
    expect(vi.mocked(driver.video.pause).mock.invocationCallOrder.at(-1)).toBeLessThan(
      vi.mocked(driver.audio.pause).mock.invocationCallOrder.at(-1) ?? Infinity,
    );
    controller.dispose();
  });

  it("keeps the Timeline on native video time across audio alignment", async () => {
    const playback = createPlaybackDriver();
    let audioPosition = 0.65;
    vi.mocked(playback.driver.audio.getCurrentTimeSeconds).mockImplementation(() => audioPosition);
    vi.mocked(playback.driver.audio.startAlignedWithVideoAt).mockResolvedValue(0.65);
    vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(0.5);
    const performanceNowSpy = vi.spyOn(performance, "now").mockReturnValue(100);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() =>
      expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledOnce(),
    );
    playback.playbackFrameCallback(0, 0.7);
    await Promise.resolve();
    audioPosition = 0.67;
    playback.playbackFrameCallback(0, 0.75);

    expect(controller.getSnapshot().positionMicros).toBe(750_000);

    performanceNowSpy.mockRestore();
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
      positionMicros: 250_000,
    });
    expect(playback.driver.video.pause).toHaveBeenCalled();
    expect(playback.driver.audio.pause).toHaveBeenCalled();
    controller.dispose();
  });

  it("preserves the scrub target when pause and delayed timeupdate follow the seek", () => {
    const playback = createPlaybackDriver();
    vi.mocked(playback.driver.video.getCurrentTimeSeconds).mockReturnValue(0.2);
    vi.mocked(playback.driver.video.isSeekPending).mockReturnValue(true);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.seek(800_000);
    controller.pause();
    playback.observer.onTimeUpdate(0.2);

    expect(controller.getSnapshot()).toMatchObject({
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
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
    const stalePlaybackFrame = playback.playbackFrameCallback;
    vi.mocked(driver.video.seek).mockImplementation((_seconds, _approximate, onSettled) => {
      seekCallbacks.push(onSettled);
    });

    controller.seek(500_000);
    controller.seek(750_000);
    stalePlaybackFrame(0, 1.5);

    expect(controller.getSnapshot().positionMicros).toBe(750_000);

    seekCallbacks[0]?.();
    expect(controller.isPlaying).toBe(false);
    seekCallbacks[1]?.();
    expect(controller.getSnapshot().positionMicros).toBe(750_000);
    controller.play();
    await vi.waitFor(() => expect(seekCallbacks).toHaveLength(3));
    seekCallbacks[2]?.();
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
    playback.playbackFrameCallback(0, 0.8);

    expect(controller.getSnapshot().positionMicros).toBe(800_000);
    controller.dispose();
  });

  it("keeps playback active when a delayed pause event follows rapid scrubbing and resume", async () => {
    const playback = createPlaybackDriver();
    const { driver } = playback;
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledTimes(1));
    playback.playbackFrameCallback(0, 0.15);
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

    controller.seek(1_200_000);
    controller.seek(400_000);
    controller.seek(1_000_000);
    controller.seek(550_000);
    vi.mocked(driver.video.getCurrentTimeSeconds).mockReturnValue(0.55);
    vi.mocked(driver.audio.getCurrentTimeSeconds).mockReturnValue(0.55);
    playback.observer.onPause(true);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
      positionMicros: 550_000,
    });
    expect(driver.audio.pause).toHaveBeenCalled();

    controller.play();
    await vi.waitFor(() => expect(driver.audio.prepareAt).toHaveBeenLastCalledWith(0.55));
    await vi.waitFor(() => expect(driver.audio.startAlignedWithVideoAt).toHaveBeenCalledTimes(2));
    playback.playbackFrameCallback(0, 0.8);
    await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

    expect(driver.video.seek).toHaveBeenLastCalledWith(0.55, false, expect.any(Function));
    expect(controller.getSnapshot().positionMicros).toBe(800_000);

    const audioPauseCount = vi.mocked(driver.audio.pause).mock.calls.length;
    playback.observer.onPause(false);

    expect(controller.isPlaying).toBe(true);
    expect(driver.audio.pause).toHaveBeenCalledTimes(audioPauseCount);
    controller.dispose();
  });

  it("reports playing on the native play event before the play promise resolves", async () => {
    const playback = createPlaybackDriver();
    const startPreview = createDeferred<number>();
    vi.mocked(playback.driver.video.play).mockReturnValue(startPreview.promise);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.play();
    await vi.waitFor(() => expect(playback.driver.video.play).toHaveBeenCalled());
    playback.observer.onPlay();

    expect(controller.isPlaying).toBe(true);
    expect(playback.driver.video.pause).not.toHaveBeenCalled();

    controller.togglePlayback();
    expect(controller.isPlaying).toBe(false);
    startPreview.resolve(0);
    await Promise.resolve();
    expect(controller.isPlaying).toBe(false);
  });

  it("cancels pending audio synchronization when toggled off and starts a fresh session when toggled on", async () => {
    const playback = createPlaybackDriver();
    const oldAudioStart = createDeferred<number>();
    vi.mocked(playback.driver.audio.startAlignedWithVideoAt)
      .mockReturnValueOnce(oldAudioStart.promise)
      .mockResolvedValueOnce(0.15);
    const controller = createPlaybackController(playback.driver, 2_000_000);

    controller.togglePlayback();
    await vi.waitFor(() =>
      expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledTimes(1),
    );
    expect(controller.isPlaying).toBe(true);

    controller.togglePlayback();
    expect(controller.isPlaying).toBe(false);
    controller.togglePlayback();
    await vi.waitFor(() =>
      expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalledTimes(2),
    );
    expect(controller.isPlaying).toBe(true);

    oldAudioStart.reject(new Error("Superseded audio startup."));
    await Promise.resolve();
    expect(controller.isPlaying).toBe(true);
    controller.dispose();
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

    expect(controller.isPlaying).toBe(false);
    expect(driver.video.play).toHaveBeenCalled();
  });

  it("waits for required Web Audio readiness before starting", () => {
    const { driver } = createPlaybackDriver();
    driver.audio.isReady = false;
    const controller = createPlaybackController(driver, 2_000_000);

    controller.play();

    expect(driver.audio.prepareAt).not.toHaveBeenCalled();
    expect(controller.isPlaying).toBe(false);
  });

  it("keeps video mute policy out of the shared playback snapshot", () => {
    const { driver } = createPlaybackDriver();
    const controller = createPlaybackController(driver, 2_000_000);
    const updatedDriver = { ...driver, audio: { ...driver.audio, hasActiveOutput: false } };

    controller.attach(1, updatedDriver, 2_000_000);

    expect(controller.getSnapshot()).toEqual({
      durationMicros: 2_000_000,
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
      positionMicros: 0,
    });
  });

  describe("on the source's frames", () => {
    // 30 FPS frames: frame k starts at round(k * 33333.3) microseconds.
    const frameRate = { denominator: 1, numerator: 30, displayValue: 30 };
    const frames = (durationMicros: number) => createNominalFrameIndex(durationMicros, frameRate);

    async function startPlaying(
      durationMicros: number,
      options: Omit<Parameters<PlaybackController["setOptions"]>[0], "frameIndex">,
    ) {
      const playback = createPlaybackDriver();
      const controller = createPlaybackController(playback.driver, durationMicros);
      controller.setOptions({ frameIndex: frames(durationMicros), ...options });
      controller.play();
      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
      return { controller, playback };
    }

    it("follows the media clock while playing, between frame boundaries", async () => {
      const { controller, playback } = await startPlaying(10_000_000, {
        loop: false,
        segment: null,
      });

      playback.playbackFrameCallback(0, 1.012);
      expect(controller.getSnapshot().positionMicros).toBe(1_012_000);
      playback.playbackFrameCallback(7, 1.019);
      expect(controller.getSnapshot().positionMicros).toBe(1_019_000);
      controller.dispose();
    });

    it("pauses on the next frame boundary instead of stepping back", async () => {
      const { controller, playback } = await startPlaying(10_000_000, {
        loop: false,
        segment: null,
      });

      playback.playbackFrameCallback(0, 1.012);

      controller.togglePlayback();
      expect(controller.isPlaying).toBe(true);
      playback.playbackFrameCallback(7, 1.025);
      expect(controller.isPlaying).toBe(true);
      expect(controller.getSnapshot().positionMicros).toBe(1_025_000);

      // Frame 31 starts at 1.033333 s: the clock reaches it, and the position rests there.
      playback.playbackFrameCallback(14, 1.034);
      expect(controller.isPlaying).toBe(false);
      expect(controller.getSnapshot().positionMicros).toBe(1_033_333);
      // The video shows that frame through its midpoint.
      expect(playback.driver.video.seek).toHaveBeenLastCalledWith(1.05, false);
      controller.dispose();
    });

    it("stops a segment on its end boundary, showing the segment's last frame", async () => {
      const { controller, playback } = await startPlaying(10_000_000, {
        loop: false,
        segment: { startMicros: 2_000_000, endMicros: 4_000_000 },
      });

      playback.playbackFrameCallback(0, 3.99);
      expect(controller.isPlaying).toBe(true);
      playback.playbackFrameCallback(7, 4.003);

      expect(controller.isPlaying).toBe(false);
      expect(controller.getSnapshot().positionMicros).toBe(4_000_000);
      // Frame 119 (3.966667 s) is the segment's last frame.
      expect(playback.driver.video.seek).toHaveBeenLastCalledWith(3.983334, false);
      controller.dispose();
    });

    it("wraps a looping segment at its end and keeps playing", async () => {
      const { controller, playback } = await startPlaying(10_000_000, {
        loop: true,
        segment: { startMicros: 2_000_000, endMicros: 4_000_000 },
      });

      playback.playbackFrameCallback(0, 4.003);
      expect(controller.getSnapshot().positionMicros).toBe(2_000_000);
      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
      expect(playback.driver.audio.prepareAt).toHaveBeenLastCalledWith(2.016667);
      controller.dispose();
    });

    it("starts a segment run anywhere, before the segment too", async () => {
      const { controller, playback } = await startPlaying(10_000_000, {
        loop: false,
        segment: { startMicros: 2_000_000, endMicros: 4_000_000 },
      });

      expect(playback.driver.audio.prepareAt).toHaveBeenLastCalledWith(0.016667);
      playback.playbackFrameCallback(0, 1);
      expect(controller.isPlaying).toBe(true);
      expect(controller.getSnapshot().positionMicros).toBe(1_000_000);
      controller.dispose();
    });

    it("plays a run started after the segment end through to the source end", async () => {
      const playback = createPlaybackDriver();
      const controller = createPlaybackController(playback.driver, 10_000_000);
      controller.setOptions({
        frameIndex: frames(10_000_000),
        loop: false,
        segment: { startMicros: 2_000_000, endMicros: 4_000_000 },
      });
      controller.seek(5_000_000);
      controller.play();
      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

      playback.playbackFrameCallback(0, 9);
      expect(controller.isPlaying).toBe(true);
      vi.mocked(playback.driver.video.isEnded).mockReturnValue(true);
      playback.observer.onEnded();

      expect(controller.isPlaying).toBe(false);
      expect(controller.getSnapshot().positionMicros).toBe(10_000_000);
      controller.dispose();
    });

    it("loops a run started after the segment end back to the segment start", async () => {
      const playback = createPlaybackDriver();
      const controller = createPlaybackController(playback.driver, 10_000_000);
      controller.setOptions({
        frameIndex: frames(10_000_000),
        loop: true,
        segment: { startMicros: 2_000_000, endMicros: 4_000_000 },
      });
      controller.seek(5_000_000);
      controller.play();
      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

      vi.mocked(playback.driver.video.isEnded).mockReturnValue(true);
      playback.observer.onEnded();
      vi.mocked(playback.driver.video.isEnded).mockReturnValue(false);
      expect(controller.getSnapshot().positionMicros).toBe(2_000_000);
      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));

      // The restarted run began inside the segment, so it wraps at the segment end again.
      playback.playbackFrameCallback(0, 4.003);
      expect(controller.getSnapshot().positionMicros).toBe(2_000_000);
      controller.dispose();
    });

    it("rests on the media's end boundary when the media ends", async () => {
      const { controller, playback } = await startPlaying(2_000_000, {
        loop: false,
        segment: null,
      });

      vi.mocked(playback.driver.video.isEnded).mockReturnValue(true);
      playback.observer.onPause(true);
      expect(controller.isPlaying).toBe(true);
      playback.observer.onEnded();

      expect(controller.isPlaying).toBe(false);
      expect(controller.getSnapshot().positionMicros).toBe(2_000_000);
      controller.dispose();
    });

    it("loops the complete source when the media ends", async () => {
      const { controller, playback } = await startPlaying(2_000_000, {
        loop: true,
        segment: null,
      });

      vi.mocked(playback.driver.video.isEnded).mockReturnValue(true);
      playback.observer.onEnded();
      vi.mocked(playback.driver.video.isEnded).mockReturnValue(false);

      expect(controller.getSnapshot().positionMicros).toBe(0);
      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
      controller.dispose();
    });

    it("keeps playing after the pause event queued by the loop restart", async () => {
      const { controller, playback } = await startPlaying(10_000_000, {
        loop: true,
        segment: { startMicros: 2_000_000, endMicros: 4_000_000 },
      });

      playback.playbackFrameCallback(0, 4.003);
      playback.observer.onPause(true);

      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
      expect(playback.driver.video.play).toHaveBeenCalledTimes(2);
      controller.dispose();
    });

    it("ignores the ended state of a paused video", () => {
      const playback = createPlaybackDriver();
      const controller = createPlaybackController(playback.driver, 2_000_000);
      controller.setOptions({ frameIndex: frames(2_000_000), loop: false, segment: null });
      controller.seek(1_966_667);

      vi.mocked(playback.driver.video.isEnded).mockReturnValue(true);
      playback.observer.onPause(true);
      playback.observer.onEnded();

      expect(controller.getSnapshot().positionMicros).toBe(1_966_667);
      controller.dispose();
    });

    it("restarts from the range start when Play is pressed at its end", async () => {
      const { controller, playback } = await startPlaying(2_000_000, {
        loop: false,
        segment: null,
      });

      vi.mocked(playback.driver.video.isEnded).mockReturnValue(true);
      playback.observer.onEnded();
      vi.mocked(playback.driver.video.isEnded).mockReturnValue(false);
      expect(controller.getSnapshot().positionMicros).toBe(2_000_000);

      controller.play();
      await vi.waitFor(() => expect(controller.isPlaying).toBe(true));
      expect(playback.driver.audio.prepareAt).toHaveBeenLastCalledWith(0.016667);
      controller.dispose();
    });

    it("prefetches the loop start audio while looping playback runs", async () => {
      const { controller, playback } = await startPlaying(10_000_000, {
        loop: false,
        segment: null,
      });

      await vi.waitFor(() =>
        expect(playback.driver.audio.startAlignedWithVideoAt).toHaveBeenCalled(),
      );
      expect(playback.driver.audio.prefetchAt).not.toHaveBeenCalled();

      controller.setOptions({
        frameIndex: frames(10_000_000),
        loop: true,
        segment: { startMicros: 2_000_000, endMicros: 4_000_000 },
      });
      expect(playback.driver.audio.prefetchAt).toHaveBeenLastCalledWith(2);
      controller.dispose();
    });
  });
});
