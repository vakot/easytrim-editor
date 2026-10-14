import type { AudioPlaybackAdapter } from "@/features/audio";
import type { PreviewVideoAdapter } from "@/features/preview";
import { diagnostics } from "@/lib/diagnostics";

interface PlaybackDriver {
  audio: AudioPlaybackAdapter;
  video: PreviewVideoAdapter;
}

interface PlaybackSnapshot {
  durationMicros: number;
  positionMicros: number;
}

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
        this.finishAtEndOfMedia("ended_event");
      },
      onPause: (isPaused) => {
        if (this.mediaSessionId !== mediaSessionId) return;
        if (!isPaused) return;
        if (this.driver?.video.isEnded()) {
          this.finishAtEndOfMedia("pause_event");
          return;
        }
        if (this.lifecycle === "paused") return;
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
          this.finishAtEndOfMedia("time_update");
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

  seek = (positionMicros: number) => {
    if (!this.driver || this.mediaSessionId === null || this.mediaSessionId === undefined) return;
    const nextPosition = Math.max(
      0,
      Math.min(this.snapshot.durationMicros, Math.round(positionMicros)),
    );

    if (!Number.isFinite(nextPosition)) return;
    // A scrub is a paused transport operation. Only Play can start a new session.
    this.cancelStartup();
    this.transitionLifecycle("paused", false);
    this.driver.video.pause();
    this.driver.audio.pause();
    this.update(this.snapshot.durationMicros, nextPosition, true);
    const seconds = nextPosition / MICROS_PER_SECOND;
    this.driver.audio.seek(seconds);
    this.driver.video.seek(seconds, false);
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
    if (this.snapshot.positionMicros >= this.snapshot.durationMicros) this.seek(0);

    const seconds = this.snapshot.positionMicros / MICROS_PER_SECOND;
    const generation = ++this.startupGeneration;
    this.transitionLifecycle("starting");
    this.mediaStartRequested = false;
    void this.startPlayback(generation, seconds);
  };

  pause = () => {
    const driver = this.driver;

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

  private finishAtEndOfMedia(
    source: "ended_event" | "pause_event" | "time_update" | "video_frame",
  ) {
    if (
      this.lifecycle === "paused" &&
      this.snapshot.positionMicros === this.snapshot.durationMicros
    ) {
      return;
    }

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
    this.update(this.snapshot.durationMicros, this.snapshot.durationMicros, true);
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
        this.finishAtEndOfMedia("video_frame");
        return;
      }
      this.publishMediaTime(seconds);
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
