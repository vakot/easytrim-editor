import {
  createRealFrameIndex,
  type FrameIndex,
  nextBoundaryMicros,
  presentationMicrosAt,
} from "@/domain/frame-index";
import type { PlaybackRange } from "@/domain/playback";
import type { AudioPlaybackAdapter } from "@/features/audio";
import type { PreviewVideoAdapter } from "@/features/preview";
import { diagnostics } from "@/lib/diagnostics";

interface PlaybackDriver {
  audio: AudioPlaybackAdapter;
  video: PreviewVideoAdapter;
}

interface PlaybackOptions {
  /** The source's real frames; paused positions rest on their boundaries. */
  frameIndex: FrameIndex;
  loop: boolean;
  segment: PlaybackRange | null;
}

interface PlaybackSnapshot {
  durationMicros: number;
  positionMicros: number;
}

/** Ends a playback hold; `resume: false` keeps an interrupted run paused. */
type PlaybackHoldRelease = (options?: { resume?: boolean }) => void;

const MICROS_PER_SECOND = 1_000_000;

/**
 * One transport for the preview video and the Web Audio tracks. While playing, the position is
 * the media clock. Paused positions rest on frame boundaries: a requested pause lets the clock
 * reach the next boundary, and a range end stops on the range's end boundary.
 *
 * An enabled segment constrains only where playback stops and loops, never where it starts: a run
 * started before the segment end stops (or loops) there, one started after it plays to the source
 * end, and a loop restarts from the segment start.
 */
class PlaybackController {
  private snapshot: PlaybackSnapshot = { durationMicros: 0, positionMicros: 0 };
  private readonly listeners = new Set<() => void>();
  private driver: PlaybackDriver | null = null;
  private mediaSessionId: number | null | undefined;
  private unregisterMediaObserver: (() => void) | null = null;
  private unregisterAudioPlaybackErrorObserver: (() => void) | null = null;
  private lifecycle: "paused" | "starting" | "playing" = "paused";
  private startupGeneration = 0;
  private mediaStartRequested = false;
  private clockFrame: ReturnType<PreviewVideoAdapter["requestPlaybackFrame"]> = null;
  private clockGeneration = 0;
  /** A requested pause waiting for the clock to reach this frame boundary. */
  private pauseAtMicros: number | null = null;
  /** Where the current run started, which decides whether it stops at the segment end. */
  private runStartMicros = 0;
  /** Active holds; while any is active, playback cannot start. */
  private holds = 0;
  /** The session whose run the first hold interrupted, resumed when the last hold is released. */
  private resumeSessionId: number | null = null;
  private options: PlaybackOptions = {
    frameIndex: createRealFrameIndex([], 0),
    loop: false,
    segment: null,
  };

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

  /** Moves a paused transport to `positionMicros` and shows the frame on screen there. */
  seek = (positionMicros: number) => {
    this.seekShowing(positionMicros, positionMicros);
  };

  play = () => {
    const driver = this.driver;
    if (!driver || !this.hasSession() || this.lifecycle !== "paused" || this.holds > 0) return;
    if (
      !driver.video.isReady ||
      (driver.audio.hasActiveOutput && !driver.audio.isReady) ||
      this.snapshot.durationMicros <= 0
    ) {
      return;
    }
    if (this.snapshot.positionMicros >= this.snapshot.durationMicros) {
      this.seek(this.options.segment?.startMicros ?? 0);
    }
    this.runStartMicros = this.snapshot.positionMicros;

    const generation = ++this.startupGeneration;
    this.pauseAtMicros = null;
    this.transitionLifecycle("starting");
    this.mediaStartRequested = false;
    void this.startPlayback(generation, this.videoSecondsFor(this.snapshot.positionMicros));
  };

  /** Stops right away where the media clock is. */
  pause = () => {
    const wasActive = this.lifecycle !== "paused";
    const clockMicros = this.clockMicros();
    this.halt();
    if (wasActive) this.update(this.snapshot.durationMicros, clockMicros, true);
    this.driver?.audio.seek(this.snapshot.positionMicros / MICROS_PER_SECOND);
    this.notifyListeners();
  };

  /**
   * Pauses and blocks playback until the returned release is called, e.g. for a drag on the
   * timeline. Holds nest; releasing the last one resumes a run the first one interrupted, unless
   * the media session changed meanwhile or a release passes `resume: false` (an abandoned drag).
   * Releasing twice is harmless.
   */
  hold = (): PlaybackHoldRelease => {
    if (this.holds === 0) {
      const interrupted = this.lifecycle !== "paused" && this.hasSession();
      this.resumeSessionId = interrupted ? (this.mediaSessionId ?? null) : null;
      if (interrupted) this.pause();
    }
    this.holds += 1;

    let released = false;
    return ({ resume = true } = {}) => {
      if (released) return;
      released = true;
      if (!resume) this.resumeSessionId = null;
      this.holds -= 1;
      if (this.holds > 0) return;
      const interrupted =
        this.resumeSessionId !== null && this.resumeSessionId === this.mediaSessionId;

      this.resumeSessionId = null;
      if (interrupted) this.play();
    };
  };

  /** Pauses when the clock reaches the next frame boundary, so the playhead never moves back. */
  togglePlayback = () => {
    if (this.lifecycle === "paused") {
      this.play();
    } else if (this.lifecycle === "starting" || this.options.frameIndex.count === 0) {
      this.pause();
    } else if (this.pauseAtMicros === null) {
      this.pauseAtMicros = nextBoundaryMicros(this.options.frameIndex, this.clockMicros());
    }
  };

  private registerVideoObserver(video: PreviewVideoAdapter) {
    const mediaSessionId = this.mediaSessionId;
    this.unregisterMediaObserver = video.registerMediaObserver({
      onEnded: () => {
        if (this.mediaSessionId !== mediaSessionId || this.lifecycle !== "playing") return;
        this.reachRangeEnd(this.snapshot.durationMicros);
      },
      onPause: (isPaused) => {
        if (this.mediaSessionId !== mediaSessionId || !isPaused || this.lifecycle === "paused") {
          return;
        }
        // Reaching the media end pauses the element first; the ended event finishes playback.
        if (this.driver?.video.isEnded()) return;
        // Our own pause (e.g. a loop restart's seek) can be delivered after the next startup
        // began; only a pause after the media start was requested comes from elsewhere.
        if (this.lifecycle === "starting" && !this.mediaStartRequested) return;
        this.pause();
      },
      onPlay: () => {
        if (this.mediaSessionId !== mediaSessionId) return;
        const expected =
          this.lifecycle === "playing" ||
          (this.lifecycle === "starting" && this.mediaStartRequested);

        if (!expected) {
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
      onTimeUpdate: () => undefined,
    });
  }

  private registerAudioPlaybackErrorObserver(audio: AudioPlaybackAdapter) {
    const mediaSessionId = this.mediaSessionId;
    this.unregisterAudioPlaybackErrorObserver = audio.registerPlaybackErrorObserver(() => {
      if (this.mediaSessionId !== mediaSessionId || this.lifecycle === "paused") return;
      this.pause();
    });
  }

  private detachSession() {
    this.halt();
    this.unregisterMediaObserver?.();
    this.unregisterMediaObserver = null;
    this.unregisterAudioPlaybackErrorObserver?.();
    this.unregisterAudioPlaybackErrorObserver = null;
  }

  /** Stops both participants without changing the published position. */
  private halt() {
    this.cancelStartup();
    this.pauseAtMicros = null;
    this.transitionLifecycle("paused", false);
    this.driver?.video.pause();
    this.driver?.audio.pause();
  }

  /** Rests the transport at `positionMicros` while the video shows the frame at `showingMicros`. */
  private seekShowing(positionMicros: number, showingMicros: number) {
    const driver = this.driver;
    if (!driver || !this.hasSession()) return;
    const position = this.clamp(positionMicros);
    this.halt();
    this.update(this.snapshot.durationMicros, position, true);
    driver.audio.seek(position / MICROS_PER_SECOND);
    driver.video.seek(this.videoSecondsFor(this.clamp(showingMicros)), false);
  }

  /** Seek target for the frame on screen at `micros`: its midpoint, which Chromium maps exactly. */
  private videoSecondsFor(micros: number) {
    const { frameIndex } = this.options;
    const target = frameIndex.count > 0 ? presentationMicrosAt(frameIndex, micros) : micros;
    return target / MICROS_PER_SECOND;
  }

  private async startPlayback(generation: number, seconds: number) {
    const driver = this.driver;
    if (!driver) return;
    try {
      await driver.audio.prepareAt(seconds);
      if (!this.isCurrentStartup(generation)) return;

      await new Promise<void>((resolve) => {
        driver.video.seek(seconds, false, resolve);
      });
      if (!this.isCurrentStartup(generation)) return;

      this.mediaStartRequested = true;
      const presentationPosition = await driver.video.play();
      if (!this.isCurrentStartup(generation)) return;

      this.mediaStartRequested = false;
      if (this.lifecycle === "starting") this.transitionLifecycle("playing");

      const durationSeconds = this.snapshot.durationMicros / MICROS_PER_SECOND;
      await driver.audio.startAlignedWithVideoAt(
        Math.max(0, Math.min(durationSeconds, presentationPosition)),
      );
      if (this.isCurrentStartup(generation)) this.prefetchLoopStart();
    } catch (error: unknown) {
      if (!this.isCurrentStartup(generation)) return;
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

  private isCurrentStartup(generation: number) {
    return generation === this.startupGeneration && this.lifecycle !== "paused";
  }

  private cancelStartup() {
    this.startupGeneration += 1;
    this.mediaStartRequested = false;
  }

  private transitionLifecycle(next: "paused" | "starting" | "playing", notify = true) {
    if (this.lifecycle === next) return;
    const wasPlaying = this.lifecycle === "playing";
    this.lifecycle = next;
    if (next === "playing") this.startClock();
    else if (wasPlaying) this.stopClock();
    if (notify && wasPlaying !== (next === "playing")) this.notifyListeners();
  }

  /** Publishes the media clock on every display refresh and applies stops on boundaries. */
  private startClock() {
    if (this.clockFrame) return;
    const generation = ++this.clockGeneration;
    const tick = () => {
      if (generation !== this.clockGeneration) return;
      this.clockFrame = null;
      const driver = this.driver;
      if (!driver || !this.hasSession()) return;

      const clockMicros = this.clockMicros();
      if (this.pauseAtMicros !== null && clockMicros >= this.pauseAtMicros) {
        const boundary = this.pauseAtMicros;
        this.seekShowing(boundary, boundary);
        return;
      }
      const range = this.playbackRange();
      if (range.endMicros < this.snapshot.durationMicros && clockMicros >= range.endMicros) {
        this.reachRangeEnd(range.endMicros);
        return;
      }
      this.setPosition(clockMicros);
      if (generation === this.clockGeneration && this.lifecycle === "playing") {
        this.clockFrame = driver.video.requestPlaybackFrame(tick);
      }
    };

    this.clockFrame = this.driver?.video.requestPlaybackFrame(tick) ?? null;
  }

  private stopClock() {
    this.clockGeneration += 1;
    this.clockFrame?.cancel();
    this.clockFrame = null;
  }

  /** Loops back to the range start, or rests on the end boundary showing the range's last frame. */
  private reachRangeEnd(endMicros: number) {
    const range = this.playbackRange();
    if (this.options.loop && this.pauseAtMicros === null && range.endMicros > range.startMicros) {
      this.seek(range.startMicros);
      this.play();
      return;
    }
    this.seekShowing(endMicros, endMicros - 1);
  }

  /** Decodes the loop's restart audio ahead of time so wrapping around needs no decode. */
  private prefetchLoopStart() {
    if (!this.options.loop || !this.driver) return;
    this.driver.audio.prefetchAt(this.playbackRange().startMicros / MICROS_PER_SECOND);
  }

  /** The current run's loop start and stop point. */
  private playbackRange(): PlaybackRange {
    const { segment } = this.options;
    const startMicros = segment?.startMicros ?? 0;
    const stopsAtSegmentEnd = segment !== null && this.runStartMicros < segment.endMicros;
    return {
      startMicros,
      endMicros: stopsAtSegmentEnd ? segment.endMicros : this.snapshot.durationMicros,
    };
  }

  private clockMicros() {
    const seconds = this.driver?.video.getCurrentTimeSeconds();
    return seconds === null || seconds === undefined
      ? this.snapshot.positionMicros
      : this.clamp(seconds * MICROS_PER_SECOND);
  }

  private clamp(micros: number) {
    const value = Number.isFinite(micros) ? Math.round(micros) : 0;
    return Math.max(0, Math.min(this.snapshot.durationMicros, value));
  }

  private hasSession() {
    return this.mediaSessionId !== null && this.mediaSessionId !== undefined;
  }

  private setPosition(positionMicros: number) {
    if (positionMicros === this.snapshot.positionMicros) return;
    this.update(this.snapshot.durationMicros, positionMicros);
  }

  private update(durationMicros: number, positionMicros: number, force = false) {
    if (
      !force &&
      durationMicros === this.snapshot.durationMicros &&
      positionMicros === this.snapshot.positionMicros
    ) {
      return;
    }
    this.snapshot = { durationMicros, positionMicros };
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.listeners) listener();
  }
}

export { PlaybackController };
export type { PlaybackDriver, PlaybackHoldRelease };
