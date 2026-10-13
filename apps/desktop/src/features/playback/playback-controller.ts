import type { AudioPlaybackAdapter } from "@/features/audio";
import type { PreviewPlaybackFrame, PreviewVideoAdapter } from "@/features/preview";

interface PlaybackDriver {
  audio: AudioPlaybackAdapter;
  video: PreviewVideoAdapter;
}

interface PlaybackSnapshot {
  durationMicros: number;
  isPlaying: boolean;
  isVideoMuted: boolean;
  positionMicros: number;
}

const MICROS_PER_SECOND = 1_000_000;

class PlaybackController {
  private snapshot: PlaybackSnapshot;
  private readonly listeners = new Set<() => void>();
  private unregisterMediaObserver: (() => void) | null = null;
  private playbackFrame: PreviewPlaybackFrame | null = null;
  private startupGeneration = 0;
  private lifecycle: "paused" | "starting" | "playing" = "paused";
  private mediaStartRequested = false;
  private lastVideoSyncAt = 0;

  constructor(
    private driver: PlaybackDriver,
    durationMicros: number,
  ) {
    this.snapshot = {
      durationMicros,
      isVideoMuted: driver.audio.hasActiveOutput,
      isPlaying: false,
      positionMicros: 0,
    };
  }

  updateDriver = (driver: PlaybackDriver) => {
    this.driver = driver;
    if (driver.audio.hasActiveOutput !== this.snapshot.isVideoMuted) {
      this.update({ ...this.snapshot, isVideoMuted: driver.audio.hasActiveOutput });
    }
  };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  connect = () => {
    const driver = this.driver;
    driver.video.setPlaybackRate(1);
    driver.audio.setPlaybackRate(1);
    this.unregisterMediaObserver = driver.video.registerMediaObserver({
      onEnded: () => {
        this.setPosition(this.snapshot.durationMicros);
        this.pause();
      },
      onPause: () => {
        this.cancelStartup();
        this.stopPlaybackClock();
        this.lifecycle = "paused";
        this.driver.audio.pause();
        this.setIsPlaying(false);
      },
      onPlay: () => {
        const isExpectedPlay =
          this.lifecycle === "playing" ||
          (this.lifecycle === "starting" && this.mediaStartRequested);

        if (!isExpectedPlay) this.driver.video.pause();
      },
      onPlaybackError: () => this.pause(),
      onTimeUpdate: (seconds) => {
        if (!this.snapshot.isPlaying) this.publishMediaTime(seconds);
      },
    });

    return () => {
      this.unregisterMediaObserver?.();
      this.unregisterMediaObserver = null;
      this.cancelStartup();
      this.lifecycle = "paused";
      this.stopPlaybackClock();
      driver.video.pause();
      driver.audio.pause();
    };
  };

  seek = (positionMicros: number) => {
    if (this.lifecycle === "starting") {
      this.cancelStartup();
      this.driver.video.pause();
      this.driver.audio.pause();
    }
    const nextPosition = Math.max(0, Math.min(this.snapshot.durationMicros, positionMicros));
    if (!Number.isFinite(nextPosition)) return;
    this.setPosition(nextPosition);
    const seconds = nextPosition / MICROS_PER_SECOND;
    this.driver.audio.seek(seconds);
    this.driver.video.seek(seconds, false);
  };

  play = () => {
    const driver = this.driver;
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
    driver.video.setPlaybackRate(1);
    driver.audio.setPlaybackRate(1);
    void this.startPlayback(generation, seconds);
  };

  pause = () => {
    this.cancelStartup();
    this.lifecycle = "paused";
    this.stopPlaybackClock();
    this.driver.video.pause();
    this.driver.audio.pause();
    this.setIsPlaying(false);
  };

  togglePlayback = () => {
    if (this.snapshot.isPlaying || this.lifecycle === "starting") this.pause();
    else this.play();
  };

  private publishMediaTime(seconds: number) {
    if (this.driver.video.isSeekPending()) return;
    this.setPosition(seconds * MICROS_PER_SECOND);
  }

  private async startPlayback(generation: number, seconds: number) {
    try {
      await this.driver.audio.resume();
      if (!this.isCurrentStartup(generation)) return;

      await new Promise<void>((resolve) => {
        this.driver.video.seek(seconds, false, resolve);
      });
      if (!this.isCurrentStartup(generation)) return;

      await this.driver.audio.startAt(seconds);
      if (!this.isCurrentStartup(generation)) return;

      this.mediaStartRequested = true;
      await this.driver.video.play();
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
    const tick = (_timestamp: number, seconds: number) => {
      const audioClockSeconds = this.driver.audio.getCurrentTimeSeconds();
      const clockSeconds = audioClockSeconds ?? seconds;
      if (!this.driver.video.isSeekPending()) {
        this.publishMediaTime(clockSeconds);
        if (audioClockSeconds !== null) this.syncVideoToAudio(audioClockSeconds);
        if (this.snapshot.positionMicros >= this.snapshot.durationMicros) {
          this.pause();
          return;
        }
      }
      this.playbackFrame = this.driver.video.requestPlaybackFrame(tick);
    };

    this.playbackFrame = this.driver.video.requestPlaybackFrame(tick);
  }

  private syncVideoToAudio(seconds: number) {
    const now = performance.now();
    if (now - this.lastVideoSyncAt < 500) return;
    this.lastVideoSyncAt = now;

    const videoSeconds = this.driver.video.getCurrentTimeSeconds();
    if (videoSeconds !== null && Math.abs(videoSeconds - seconds) > 0.12) {
      this.driver.video.setCurrentTimeSeconds(seconds);
    }
  }

  private stopPlaybackClock() {
    this.playbackFrame?.cancel();
    this.playbackFrame = null;
  }

  private update(snapshot: PlaybackSnapshot) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

export { PlaybackController };
export type { PlaybackDriver };
