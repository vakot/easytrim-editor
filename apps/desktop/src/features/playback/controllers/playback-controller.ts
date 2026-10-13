import type { AudioPlaybackAdapter } from "@/features/audio";
import type { PreviewVideoAdapter } from "@/features/preview";

interface PlaybackDriver {
  audio: AudioPlaybackAdapter;
  video: PreviewVideoAdapter;
}

interface PlaybackSnapshot {
  durationMicros: number;
  isPlaying: boolean;
  positionMicros: number;
}

const MICROS_PER_SECOND = 1_000_000;

class PlaybackController {
  private snapshot: PlaybackSnapshot;
  private readonly listeners = new Set<() => void>();
  private driver: PlaybackDriver | null = null;
  private unregisterMediaObserver: (() => void) | null = null;
  private playbackFrame: ReturnType<PreviewVideoAdapter["requestPlaybackFrame"]> = null;
  private startupFrame: ReturnType<PreviewVideoAdapter["requestPlaybackFrame"]> = null;
  private resolveStartupFrameWait: (() => void) | null = null;
  private startupGeneration = 0;
  private playbackClockGeneration = 0;
  private seekGeneration = 0;
  private mediaSessionId: number | null | undefined;
  private lifecycle: "paused" | "starting" | "playing" = "paused";
  private mediaStartRequested = false;
  private lastVideoSyncAt = 0;

  constructor() {
    this.snapshot = {
      durationMicros: 0,
      isPlaying: false,
      positionMicros: 0,
    };
  }

  attach = (mediaSessionId: number | null, driver: PlaybackDriver, durationMicros: number) => {
    const sessionChanged = this.mediaSessionId !== mediaSessionId;
    const videoObserverChanged =
      this.driver?.video.registerMediaObserver !== driver.video.registerMediaObserver;

    if (sessionChanged) this.detachSession();

    if (!sessionChanged && videoObserverChanged) {
      this.unregisterMediaObserver?.();
      this.unregisterMediaObserver = null;
    }

    this.mediaSessionId = mediaSessionId;
    this.driver = driver;
    if (mediaSessionId !== null) {
      if (sessionChanged || videoObserverChanged) this.registerVideoObserver(driver.video);
    }

    const nextSnapshot = {
      ...this.snapshot,
      durationMicros: mediaSessionId === null ? 0 : durationMicros,
      isPlaying: sessionChanged ? false : this.snapshot.isPlaying,
      positionMicros: sessionChanged
        ? 0
        : Math.min(this.snapshot.positionMicros, mediaSessionId === null ? 0 : durationMicros),
    };

    if (!this.snapshotsEqual(this.snapshot, nextSnapshot)) this.update(nextSnapshot);
  };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispose = () => {
    this.detachSession();
    this.driver = null;
    this.mediaSessionId = undefined;
    if (
      this.snapshot.durationMicros !== 0 ||
      this.snapshot.isPlaying ||
      this.snapshot.positionMicros !== 0
    ) {
      this.update({
        durationMicros: 0,
        isPlaying: false,
        positionMicros: 0,
      });
    }
  };

  private registerVideoObserver(video: PreviewVideoAdapter) {
    const mediaSessionId = this.mediaSessionId;
    this.unregisterMediaObserver = video.registerMediaObserver({
      onEnded: () => {
        if (this.mediaSessionId !== mediaSessionId) return;
        this.setPosition(this.snapshot.durationMicros);
        this.pause();
      },
      onPause: (isPaused) => {
        if (this.mediaSessionId !== mediaSessionId) return;
        if (!isPaused) return;
        this.seekGeneration += 1;
        this.cancelStartup();
        this.stopPlaybackClock();
        this.lifecycle = "paused";
        this.driver?.audio.pause();
        this.setIsPlaying(false);
      },
      onPlay: () => {
        if (this.mediaSessionId !== mediaSessionId) return;
        const isExpectedPlay =
          this.lifecycle === "playing" ||
          (this.lifecycle === "starting" && this.mediaStartRequested);

        if (!isExpectedPlay) this.driver?.video.pause();
      },
      onPlaybackError: () => {
        if (this.mediaSessionId === mediaSessionId) this.pause();
      },
      onTimeUpdate: (seconds) => {
        if (this.mediaSessionId !== mediaSessionId) return;
        if (!this.snapshot.isPlaying) this.publishMediaTime(seconds);
      },
    });
  }

  private detachSession() {
    this.cancelStartup();
    this.lifecycle = "paused";
    this.stopPlaybackClock();
    this.unregisterMediaObserver?.();
    this.unregisterMediaObserver = null;
    this.driver?.video.pause();
    this.driver?.audio.pause();
  }

  seek = (positionMicros: number) => {
    if (!this.driver || this.mediaSessionId === null || this.mediaSessionId === undefined) return;
    if (this.lifecycle === "starting") {
      this.cancelStartup();
      this.lifecycle = "paused";
      this.driver.video.pause();
      this.driver.audio.pause();
    }
    const nextPosition = Math.max(0, Math.min(this.snapshot.durationMicros, positionMicros));
    if (!Number.isFinite(nextPosition)) return;
    const seekGeneration = ++this.seekGeneration;
    const resumeClockAfterSeek = this.lifecycle === "playing" && this.snapshot.isPlaying;
    if (resumeClockAfterSeek) this.stopPlaybackClock();
    this.setPosition(nextPosition);
    const seconds = nextPosition / MICROS_PER_SECOND;
    this.driver.audio.seek(seconds);
    this.driver.video.seek(seconds, false, () => {
      if (
        seekGeneration === this.seekGeneration &&
        resumeClockAfterSeek &&
        this.lifecycle === "playing" &&
        this.snapshot.isPlaying
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
      this.snapshot.isPlaying ||
      this.lifecycle !== "paused"
    )
      return;
    if (this.snapshot.positionMicros >= this.snapshot.durationMicros) this.seek(0);

    const seconds = this.snapshot.positionMicros / MICROS_PER_SECOND;
    const generation = ++this.startupGeneration;
    this.lifecycle = "starting";
    this.mediaStartRequested = false;
    void this.startPlayback(generation, seconds);
  };

  pause = () => {
    this.seekGeneration += 1;
    this.cancelStartup();
    this.lifecycle = "paused";
    this.stopPlaybackClock();
    this.driver?.video.pause();
    this.driver?.audio.pause();
    this.setIsPlaying(false);
  };

  togglePlayback = () => {
    if (this.snapshot.isPlaying || this.lifecycle === "starting") this.pause();
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
      if (!this.isCurrentStartup(generation)) return;

      await new Promise<void>((resolve) => {
        driver.video.seek(seconds, false, resolve);
      });
      if (!this.isCurrentStartup(generation)) return;

      this.mediaStartRequested = true;
      await driver.video.play();
      if (!this.isCurrentStartup(generation)) return;

      const durationSeconds = this.snapshot.durationMicros / MICROS_PER_SECOND;
      const videoPosition = Math.max(
        0,
        Math.min(durationSeconds, driver.video.getCurrentTimeSeconds() ?? seconds),
      );

      const audioStartPosition = await driver.audio.startAlignedWithVideoAt(videoPosition);

      if (!this.isCurrentStartup(generation)) return;

      if (driver.audio.getCurrentTimeSeconds() !== null) {
        const reachedSharedStart = await this.waitForVideoPosition(generation, audioStartPosition);
        if (!reachedSharedStart) return;
      }
      if (this.isCurrentStartup(generation)) this.finishStartup();
    } catch {
      if (this.isCurrentStartup(generation)) this.pause();
    }
  }

  private isCurrentStartup(generation: number) {
    return generation === this.startupGeneration && this.lifecycle === "starting";
  }

  private finishStartup() {
    this.lifecycle = "playing";
    this.mediaStartRequested = false;
    this.setIsPlaying(true);
  }

  private cancelStartup() {
    this.startupGeneration += 1;
    this.mediaStartRequested = false;
    this.startupFrame?.cancel();
    this.startupFrame = null;
    this.resolveStartupFrameWait?.();
    this.resolveStartupFrameWait = null;
  }

  private waitForVideoPosition(generation: number, targetSeconds: number): Promise<boolean> {
    const driver = this.driver;
    if (!driver || !this.isCurrentStartup(generation)) return Promise.resolve(false);
    const currentPosition = driver.video.getCurrentTimeSeconds();
    if (currentPosition !== null && currentPosition >= targetSeconds) return Promise.resolve(true);

    return new Promise((resolve) => {
      const finish = (reached: boolean) => {
        this.startupFrame = null;
        this.resolveStartupFrameWait = null;
        resolve(reached);
      };

      const checkPosition = (_timestamp: number, mediaTimeSeconds: number) => {
        this.startupFrame = null;
        if (!this.isCurrentStartup(generation)) {
          finish(false);
          return;
        }
        if (mediaTimeSeconds >= targetSeconds) {
          finish(true);
          return;
        }

        const frame = driver.video.requestPlaybackFrame(checkPosition);
        if (frame) this.startupFrame = frame;
        else finish(false);
      };

      this.resolveStartupFrameWait = () => finish(false);
      const frame = driver.video.requestPlaybackFrame(checkPosition);
      if (frame) this.startupFrame = frame;
      else finish(false);
    });
  }

  private setPosition(positionMicros: number) {
    const nextPosition = Math.max(0, Math.min(this.snapshot.durationMicros, positionMicros));
    if (!Number.isFinite(nextPosition) || nextPosition === this.snapshot.positionMicros) return;
    this.update({ ...this.snapshot, positionMicros: nextPosition });
  }

  private setIsPlaying(isPlaying: boolean) {
    if (isPlaying === this.snapshot.isPlaying) return;
    this.update({ ...this.snapshot, isPlaying });
    if (isPlaying) this.startPlaybackClock();
    else this.stopPlaybackClock();
  }

  private startPlaybackClock() {
    if (this.playbackFrame) return;
    const generation = ++this.playbackClockGeneration;
    const tick = (_timestamp: number, seconds: number) => {
      if (generation !== this.playbackClockGeneration) return;
      this.playbackFrame = null;
      const driver = this.driver;
      if (!driver || this.mediaSessionId === null || this.mediaSessionId === undefined) return;
      const audioClockSeconds = driver.audio.getCurrentTimeSeconds();
      const clockSeconds = audioClockSeconds ?? seconds;
      if (!driver.video.isSeekPending()) {
        this.publishMediaTime(clockSeconds);
        if (audioClockSeconds !== null) this.syncVideoToAudio(audioClockSeconds);
        if (this.snapshot.positionMicros >= this.snapshot.durationMicros) {
          this.pause();
          return;
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

  private update(snapshot: PlaybackSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  private snapshotsEqual(left: PlaybackSnapshot, right: PlaybackSnapshot) {
    return (
      left.durationMicros === right.durationMicros &&
      left.isPlaying === right.isPlaying &&
      left.positionMicros === right.positionMicros
    );
  }
}

export { PlaybackController };
export type { PlaybackDriver };
