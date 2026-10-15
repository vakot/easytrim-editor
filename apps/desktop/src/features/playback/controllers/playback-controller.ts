import { type FrameIndex, lastFrameBefore } from "@/domain/frame-index";
import type { PlaybackRange } from "@/domain/playback";
import type { AudioPlaybackAdapter } from "@/features/audio";
import type { PreviewVideoAdapter } from "@/features/preview";
import { diagnostics } from "@/lib/diagnostics";

interface PlaybackDriver {
  audio: AudioPlaybackAdapter;
  video: PreviewVideoAdapter;
}

interface PlaybackOptions {
  /** The source's frames; stops rest on a range's last frame rather than on its end boundary. */
  frameIndex?: FrameIndex;
  loop: boolean;
  segment: PlaybackRange | null;
}

interface PlaybackSnapshot {
  durationMicros: number;
  positionMicros: number;
}

type PlaybackEndSource =
  "ended_event" | "pause_event" | "playback_start" | "time_update" | "video_frame";

const MICROS_PER_SECOND = 1_000_000;

class PlaybackController {
  private snapshot: PlaybackSnapshot;
  private readonly listeners = new Set<() => void>();
  private driver: PlaybackDriver | null = null;
  private unregisterMediaObserver: (() => void) | null = null;
  private unregisterAudioPlaybackErrorObserver: (() => void) | null = null;
  private playbackFrame: ReturnType<PreviewVideoAdapter["requestPlaybackFrame"]> = null;
  private startupGeneration = 0;
  private playbackClockGeneration = 0;
  private mediaSessionId: number | null | undefined;
  private lifecycle: "paused" | "starting" | "playing" = "paused";
  private mediaStartRequested = false;
  private options: PlaybackOptions = { loop: false, segment: null };
  // Where the video was sought to show the paused position's frame, when that differs from it.
  private presentationMicros: number | null = null;

  constructor() {
    this.snapshot = this.createSnapshot(0, 0);
  }

  attach = (mediaSessionId: number | null, driver: PlaybackDriver, durationMicros: number) => {
    const sessionChanged = this.mediaSessionId !== mediaSessionId;
    const videoObserverChanged =
      this.driver?.video.registerMediaObserver !== driver.video.registerMediaObserver;

    const audioErrorObserverChanged =
      this.driver?.audio.registerPlaybackErrorObserver !==
      driver.audio.registerPlaybackErrorObserver;

    if (sessionChanged) this.detachSession();

    if (!sessionChanged && videoObserverChanged) {
      this.unregisterMediaObserver?.();
      this.unregisterMediaObserver = null;
    }
    if (!sessionChanged && audioErrorObserverChanged) {
      this.unregisterAudioPlaybackErrorObserver?.();
      this.unregisterAudioPlaybackErrorObserver = null;
    }

    this.mediaSessionId = mediaSessionId;
    this.driver = driver;
    if (mediaSessionId !== null) {
      if (sessionChanged || videoObserverChanged) this.registerVideoObserver(driver.video);
      if (sessionChanged || audioErrorObserverChanged) {
        this.registerAudioPlaybackErrorObserver(driver.audio);
      }
    }

    const nextDurationMicros = mediaSessionId === null ? 0 : durationMicros;
    const nextPositionMicros = sessionChanged
      ? 0
      : Math.min(this.snapshot.positionMicros, nextDurationMicros);

    this.update(nextDurationMicros, nextPositionMicros);
  };

  setOptions = (options: PlaybackOptions) => {
    this.options = options;
    if (this.lifecycle === "playing") this.prefetchLoopStart();
  };

  getSnapshot = () => this.snapshot;

  get isPlaying() {
    return this.lifecycle === "playing";
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispose = () => {
    this.detachSession();
    this.driver = null;
    this.mediaSessionId = undefined;
    if (this.snapshot.durationMicros !== 0 || this.snapshot.positionMicros !== 0) {
      this.update(0, 0);
    }
  };

  private registerVideoObserver(video: PreviewVideoAdapter) {
    const mediaSessionId = this.mediaSessionId;
    this.unregisterMediaObserver = video.registerMediaObserver({
      onEnded: () => {
        if (this.mediaSessionId !== mediaSessionId) return;
        if (!this.driver?.video.isEnded()) return;
        this.handleRangeEnd("ended_event");
      },
      onPause: (isPaused) => {
        if (this.mediaSessionId !== mediaSessionId) return;
        if (!isPaused) return;
        if (this.driver?.video.isEnded()) {
          this.handleRangeEnd("pause_event");
          return;
        }
        if (this.lifecycle === "paused") return;
        // A pause event queued by our own pause() (e.g. the loop restart seek) can arrive after
        // startup began. It must not cancel the startup; only a requested media start is real.
        if (this.lifecycle === "starting" && !this.mediaStartRequested) return;
        this.pause();
      },
      onPlay: () => {
        if (this.mediaSessionId !== mediaSessionId) return;
        const isExpectedPlay =
          this.lifecycle === "playing" ||
          (this.lifecycle === "starting" && this.mediaStartRequested);

        if (!isExpectedPlay) {
          this.driver?.video.pause();
          return;
        }
        if (this.lifecycle === "starting") {
          this.mediaStartRequested = false;
          this.transitionLifecycle("playing");
        }
      },
      onPlaybackError: () => {
        if (this.mediaSessionId === mediaSessionId) this.pause();
      },
      onTimeUpdate: () => {
        if (this.mediaSessionId !== mediaSessionId) return;
        if (this.driver?.video.isEnded()) {
          this.handleRangeEnd("time_update");
          return;
        }
      },
    });
  }

  private registerAudioPlaybackErrorObserver(audio: AudioPlaybackAdapter) {
    const mediaSessionId = this.mediaSessionId;
    this.unregisterAudioPlaybackErrorObserver = audio.registerPlaybackErrorObserver(() => {
      if (
        this.mediaSessionId !== mediaSessionId ||
        (this.lifecycle !== "playing" && this.lifecycle !== "starting")
      ) {
        return;
      }
      this.pause();
    });
  }

  private detachSession() {
    this.cancelStartup();
    this.transitionLifecycle("paused");
    this.unregisterMediaObserver?.();
    this.unregisterMediaObserver = null;
    this.unregisterAudioPlaybackErrorObserver?.();
    this.unregisterAudioPlaybackErrorObserver = null;
    this.driver?.video.pause();
    this.driver?.audio.pause();
  }

  /**
   * `presentationMicros` is where the video element seeks to display the position's frame. Frame
   * seeks pass the frame's midpoint: browsers estimate frame spans from the nominal rate, so a
   * seek to a millisecond-rounded frame start can land in the previous frame.
   */
  seek = (positionMicros: number, presentationMicros = positionMicros) => {
    if (!this.driver || this.mediaSessionId === null || this.mediaSessionId === undefined) return;
    const clamp = (micros: number) =>
      Math.max(0, Math.min(this.snapshot.durationMicros, Math.round(micros)));

    const nextPosition = clamp(positionMicros);
    const nextPresentation = clamp(presentationMicros);

    if (!Number.isFinite(nextPosition) || !Number.isFinite(nextPresentation)) return;
    // A scrub is a paused transport operation. Only Play can start a new session.
    this.cancelStartup();
    this.transitionLifecycle("paused", false);
    this.driver.video.pause();
    this.driver.audio.pause();
    this.update(this.snapshot.durationMicros, nextPosition, true);
    this.presentationMicros = nextPresentation === nextPosition ? null : nextPresentation;
    this.driver.audio.seek(nextPosition / MICROS_PER_SECOND);
    this.driver.video.seek(nextPresentation / MICROS_PER_SECOND, false);
  };

  play = () => {
    const driver = this.driver;
    if (!driver || this.mediaSessionId === null || this.mediaSessionId === undefined) return;
    if (
      !driver.video.isReady ||
      (driver.audio.hasActiveOutput && !driver.audio.isReady) ||
      this.snapshot.durationMicros <= 0 ||
      this.lifecycle !== "paused"
    )
      return;
    const range = this.playbackRange();
    // On or past the range's last frame there is nothing left to play, so start over.
    const lastFrameMicros = this.lastFrameOf(range)?.positionMicros ?? range.endMicros;
    if (
      this.snapshot.positionMicros >= Math.max(range.startMicros, lastFrameMicros) ||
      this.snapshot.positionMicros < range.startMicros
    ) {
      this.seek(range.startMicros);
    }

    // Start from the frame on screen rather than re-seeking to its boundary.
    const seconds = (this.presentationMicros ?? this.snapshot.positionMicros) / MICROS_PER_SECOND;
    this.presentationMicros = null;
    const generation = ++this.startupGeneration;
    this.transitionLifecycle("starting");
    this.mediaStartRequested = false;
    void this.startPlayback(generation, seconds);
  };

  pause = () => {
    const driver = this.driver;
    // A paused frame seek is already settled; syncing from the video would move it to the midpoint.
    if (this.lifecycle === "paused" && this.presentationMicros !== null) return;
    this.presentationMicros = null;

    this.cancelStartup();
    this.transitionLifecycle("paused", false);

    driver?.video.pause();
    const pausedVideoPosition = driver?.video.isSeekPending()
      ? null
      : driver?.video.getCurrentTimeSeconds();

    if (
      pausedVideoPosition !== null &&
      pausedVideoPosition !== undefined &&
      pausedVideoPosition < this.snapshot.durationMicros / MICROS_PER_SECOND
    ) {
      this.setPosition(pausedVideoPosition * MICROS_PER_SECOND);
    }

    driver?.audio.pause();

    driver?.audio.seek(this.snapshot.positionMicros / MICROS_PER_SECOND);
    this.notifyListeners();
  };

  togglePlayback = () => {
    if (this.lifecycle !== "paused") this.pause();
    else this.play();
  };

  private publishMediaTime(seconds: number) {
    if (this.driver?.video.isSeekPending()) return;
    this.setPosition(seconds * MICROS_PER_SECOND);
  }

  private async startPlayback(generation: number, seconds: number) {
    const driver = this.driver;
    if (!driver) return;
    try {
      await driver.audio.prepareAt(seconds);
      if (!this.isCurrentPlaybackStart(generation)) return;

      await new Promise<void>((resolve) => {
        driver.video.seek(seconds, false, resolve);
      });
      if (!this.isCurrentPlaybackStart(generation)) return;
      // Starting inside the final frame leaves nothing to play; `play()` would rewind to 0.
      if (driver.video.isEnded()) {
        this.handleRangeEnd("playback_start");
        return;
      }

      this.mediaStartRequested = true;
      const presentationPosition = await driver.video.play();
      if (!this.isCurrentPlaybackStart(generation)) return;

      this.mediaStartRequested = false;
      if (this.lifecycle === "starting") {
        this.transitionLifecycle("playing");
      }

      const durationSeconds = this.snapshot.durationMicros / MICROS_PER_SECOND;
      const videoPosition = Math.max(0, Math.min(durationSeconds, presentationPosition));

      await driver.audio.startAlignedWithVideoAt(videoPosition);
      if (this.isCurrentPlaybackStart(generation)) this.prefetchLoopStart();
    } catch (error: unknown) {
      if (!this.isCurrentPlaybackStart(generation)) return;
      diagnostics.error("media.playback.startup_failed", error, {
        data: {
          positionMicros: this.snapshot.positionMicros,
          videoSeconds: driver.video.getCurrentTimeSeconds(),
          audioSeconds: driver.audio.getCurrentTimeSeconds(),
        },
        origin: { type: "internal" },
      });
      this.pause();
    }
  }

  private isCurrentPlaybackStart(generation: number) {
    return generation === this.startupGeneration && this.lifecycle !== "paused";
  }

  private transitionLifecycle(nextLifecycle: "paused" | "starting" | "playing", notify = true) {
    if (this.lifecycle === nextLifecycle) return;
    const wasPlaying = this.lifecycle === "playing";
    this.lifecycle = nextLifecycle;

    if (nextLifecycle === "playing") this.startPlaybackClock();
    else if (wasPlaying) this.stopPlaybackClock();

    if (notify && wasPlaying !== (nextLifecycle === "playing")) this.notifyListeners();
  }

  /** Decodes the loop's restart audio ahead of time so wrapping around needs no decode. */
  private prefetchLoopStart() {
    if (!this.options.loop || !this.driver) return;
    this.driver.audio.prefetchAt(this.playbackRange().startMicros / MICROS_PER_SECOND);
  }

  private playbackRange(): PlaybackRange {
    return this.options.segment ?? { startMicros: 0, endMicros: this.snapshot.durationMicros };
  }

  private reachedRangeEnd() {
    const { endMicros } = this.playbackRange();
    // The native clock leads the presented frame, so a range ending at EOF must wait for the
    // media to end on its own; stopping on the clock would drop the final frames.
    return (
      endMicros < this.snapshot.durationMicros &&
      this.lifecycle === "playing" &&
      !this.driver?.video.isSeekPending() &&
      this.snapshot.positionMicros >= endMicros
    );
  }

  private handleRangeEnd(source: PlaybackEndSource) {
    // Reaching the end is a transition of active playback. Browsers also report `ended` for a
    // paused element positioned inside the final frame, which must not move the paused position.
    if (this.lifecycle === "paused") return;
    const range = this.playbackRange();
    if (this.options.loop && range.endMicros > range.startMicros) {
      this.seek(range.startMicros);
      this.play();
      return;
    }
    if (range.endMicros >= this.snapshot.durationMicros) {
      this.finishAtEndOfMedia(source);
      return;
    }
    const lastFrame = this.lastFrameOf(range);
    if (lastFrame) this.seek(lastFrame.positionMicros, lastFrame.presentationMicros);
    else this.seek(range.endMicros);
  }

  private lastFrameOf(range: PlaybackRange) {
    const { frameIndex } = this.options;
    return frameIndex ? lastFrameBefore(frameIndex, range.endMicros) : null;
  }

  private finishAtEndOfMedia(source: PlaybackEndSource) {
    const driver = this.driver;
    diagnostics.event("media.playback.finalized", {
      data: {
        durationMicros: this.snapshot.durationMicros,
        lifecycle: this.lifecycle,
        positionBeforeMicros: this.snapshot.positionMicros,
        source,
        videoCurrentTimeSeconds: driver?.video.getCurrentTimeSeconds() ?? null,
        videoEnded: driver?.video.isEnded() ?? false,
        audioCurrentTimeSeconds: driver?.audio.getCurrentTimeSeconds() ?? null,
      },
      origin: { type: "internal" },
    });
    this.cancelStartup();
    this.transitionLifecycle("paused", false);
    this.driver?.audio.pause();
    this.driver?.video.pause();
    // The ended video already shows the final frame; rest the position on it.
    const lastFrame = this.lastFrameOf(this.playbackRange());
    this.update(
      this.snapshot.durationMicros,
      lastFrame?.positionMicros ?? this.snapshot.durationMicros,
      true,
    );
  }

  private cancelStartup() {
    this.startupGeneration += 1;
    this.mediaStartRequested = false;
  }

  private setPosition(positionMicros: number) {
    const nextPosition = Math.max(
      0,
      Math.min(this.snapshot.durationMicros, Math.round(positionMicros)),
    );

    if (!Number.isFinite(nextPosition) || nextPosition === this.snapshot.positionMicros) return;
    this.update(this.snapshot.durationMicros, nextPosition);
  }

  private startPlaybackClock() {
    if (this.playbackFrame) return;
    const generation = ++this.playbackClockGeneration;
    const tick = (_timestamp: number, seconds: number) => {
      if (generation !== this.playbackClockGeneration) return;
      this.playbackFrame = null;
      const driver = this.driver;
      if (!driver || this.mediaSessionId === null || this.mediaSessionId === undefined) return;
      if (driver.video.isEnded()) {
        this.handleRangeEnd("video_frame");
        return;
      }
      this.publishMediaTime(seconds);
      if (this.reachedRangeEnd()) {
        this.handleRangeEnd("video_frame");
        return;
      }
      if (generation === this.playbackClockGeneration && this.lifecycle === "playing") {
        this.playbackFrame = driver.video.requestPlaybackFrame(tick);
      }
    };

    this.playbackFrame = this.driver?.video.requestPlaybackFrame(tick) ?? null;
  }

  private stopPlaybackClock() {
    this.playbackClockGeneration += 1;
    this.playbackFrame?.cancel();
    this.playbackFrame = null;
  }

  private createSnapshot(durationMicros: number, positionMicros: number): PlaybackSnapshot {
    return {
      durationMicros,
      positionMicros,
    };
  }

  private update(durationMicros: number, positionMicros: number, force = false) {
    if (
      !force &&
      durationMicros === this.snapshot.durationMicros &&
      positionMicros === this.snapshot.positionMicros
    ) {
      return;
    }
    this.snapshot = this.createSnapshot(durationMicros, positionMicros);
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.listeners) listener();
  }
}

export { PlaybackController };
export type { PlaybackDriver };
