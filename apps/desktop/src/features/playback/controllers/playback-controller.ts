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
  private startupFrame: ReturnType<PreviewVideoAdapter["requestPlaybackFrame"]> = null;
  private resolveStartupFrameWait: ((reached: boolean) => void) | null = null;
  private startupGeneration = 0;
  private playbackClockGeneration = 0;
  private seekGeneration = 0;
  private mediaSessionId: number | null | undefined;
  private lifecycle: "paused" | "starting" | "playing" = "paused";
  private mediaStartRequested = false;
  private audioAlignmentPending = false;
  private startupTargetSeconds: number | null = null;
  private lastVideoSyncAt = 0;

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
          this.audioAlignmentPending = true;
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
        if (this.lifecycle === "paused") return;
        const video = this.driver?.video;
        const currentTimeSeconds = video?.getCurrentTimeSeconds();
        if (
          video &&
          this.startupTargetSeconds !== null &&
          currentTimeSeconds !== null &&
          currentTimeSeconds !== undefined &&
          currentTimeSeconds >= this.startupTargetSeconds &&
          !video.isSeekPending()
        ) {
          this.resolveStartupFrameWait?.(true);
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
    this.cancelStartup();
    if (this.lifecycle === "starting") {
      this.transitionLifecycle("paused");
      this.driver.video.pause();
      this.driver.audio.pause();
    }
    const nextPosition = Math.max(0, Math.min(this.snapshot.durationMicros, positionMicros));
    if (!Number.isFinite(nextPosition)) return;
    const seekGeneration = ++this.seekGeneration;
    const resumeClockAfterSeek = this.lifecycle === "playing";
    if (resumeClockAfterSeek) this.stopPlaybackClock();
    this.setPosition(nextPosition);
    const seconds = nextPosition / MICROS_PER_SECOND;
    this.driver.audio.seek(seconds);
    this.driver.video.seek(seconds, false, () => {
      if (
        seekGeneration === this.seekGeneration &&
        resumeClockAfterSeek &&
        this.lifecycle === "playing"
      ) {
        this.startPlaybackClock();
      }
    });
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

    this.seekGeneration += 1;
    this.cancelStartup();
    this.transitionLifecycle("paused");

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
      await driver.video.play();
      if (!this.isCurrentPlaybackStart(generation)) return;

      this.mediaStartRequested = false;
      if (this.lifecycle === "starting") {
        this.audioAlignmentPending = true;
        this.transitionLifecycle("playing");
      }

      const durationSeconds = this.snapshot.durationMicros / MICROS_PER_SECOND;
      const videoPosition = Math.max(
        0,
        Math.min(durationSeconds, driver.video.getCurrentTimeSeconds() ?? seconds),
      );

      const audioStartPosition = await driver.audio.startAlignedWithVideoAt(videoPosition);

      if (!this.isCurrentPlaybackStart(generation)) return;

      if (driver.audio.getCurrentTimeSeconds() !== null) {
        const reachedSharedStart = await this.waitForVideoPosition(generation, audioStartPosition);
        if (!reachedSharedStart) return;
      }
      if (this.isCurrentPlaybackStart(generation)) this.audioAlignmentPending = false;
    } catch {
      if (this.isCurrentPlaybackStart(generation)) this.pause();
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
      },
      origin: { type: "internal" },
    });
    this.seekGeneration += 1;
    this.cancelStartup();
    this.transitionLifecycle("paused", false);
    this.driver?.audio.pause();
    this.driver?.video.pause();
    this.update(this.snapshot.durationMicros, this.snapshot.durationMicros, true);
  }

  private cancelStartup() {
    this.startupGeneration += 1;
    this.mediaStartRequested = false;
    this.audioAlignmentPending = false;
    this.startupFrame?.cancel();
    this.startupFrame = null;
    this.resolveStartupFrameWait?.(false);
    this.resolveStartupFrameWait = null;
    this.startupTargetSeconds = null;
  }

  private waitForVideoPosition(generation: number, targetSeconds: number): Promise<boolean> {
    const driver = this.driver;
    if (!driver || !this.isCurrentPlaybackStart(generation)) return Promise.resolve(false);
    const currentPosition = driver.video.getCurrentTimeSeconds();
    if (
      !driver.video.isSeekPending() &&
      currentPosition !== null &&
      currentPosition >= targetSeconds
    ) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const finish = (reached: boolean) => {
        this.startupFrame?.cancel();
        this.startupFrame = null;
        this.resolveStartupFrameWait = null;
        this.startupTargetSeconds = null;
        resolve(reached);
      };

      const checkPosition = (_timestamp: number, mediaTimeSeconds: number) => {
        this.startupFrame = null;
        if (!this.isCurrentPlaybackStart(generation)) {
          finish(false);
          return;
        }
        const currentTimeSeconds = driver.video.getCurrentTimeSeconds();
        if (
          !driver.video.isSeekPending() &&
          (mediaTimeSeconds >= targetSeconds ||
            (currentTimeSeconds !== null && currentTimeSeconds >= targetSeconds))
        ) {
          finish(true);
          return;
        }

        const frame = driver.video.requestPlaybackFrame(checkPosition);
        if (frame) this.startupFrame = frame;
        else finish(false);
      };

      this.startupTargetSeconds = targetSeconds;
      this.resolveStartupFrameWait = finish;
      const frame = driver.video.requestPlaybackFrame(checkPosition);
      if (frame) this.startupFrame = frame;
      else finish(false);
    });
  }

  private setPosition(positionMicros: number) {
    const nextPosition = Math.max(0, Math.min(this.snapshot.durationMicros, positionMicros));
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
      const audioClockSeconds = driver.audio.getCurrentTimeSeconds();

      if (!driver.video.isSeekPending()) {
        this.publishMediaTime(seconds);
        if (
          audioClockSeconds !== null &&
          this.lifecycle === "playing" &&
          !this.audioAlignmentPending
        ) {
          this.syncVideoToAudio(audioClockSeconds);
        }
      }
      this.playbackFrame = driver.video.requestPlaybackFrame(tick);
    };

    this.playbackFrame = this.driver?.video.requestPlaybackFrame(tick) ?? null;
  }

  private syncVideoToAudio(seconds: number) {
    const driver = this.driver;
    if (!driver) return;
    const now = performance.now();
    if (now - this.lastVideoSyncAt < 500) return;
    this.lastVideoSyncAt = now;

    const videoSeconds = driver.video.getCurrentTimeSeconds();
    if (videoSeconds !== null && Math.abs(videoSeconds - seconds) > 0.12) {
      driver.video.setCurrentTimeSeconds(seconds);
    }
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
