import type { PreviewPlaybackFrame } from "@/features/preview";

interface PlaybackDriver {
  audio: {
    getCurrentTimeSeconds: () => number | null;
    isReady: boolean;
    pause: () => void;
    requestPlaybackFrame: (
      callback: (timestamp: number, mediaTimeSeconds: number) => void,
    ) => PreviewPlaybackFrame | null;
    resumeAudioContext: () => Promise<void>;
    setPlaybackRate: (rate: number) => void;
    startAt: (seconds: number) => Promise<void>;
    syncTo: (seconds: number, force?: boolean) => void;
    usesWebAudio: boolean;
  };
  preview: {
    isReady: boolean;
    isSeekPending: () => boolean;
    pause: () => void;
    play: () => Promise<void>;
    registerMediaObserver: (observer: {
      onEnded: () => void;
      onPause: () => void;
      onPlay: () => void;
      onPlaybackError: () => void;
      onTimeUpdate: (seconds: number) => void;
    }) => () => void;
    requestPlaybackFrame: (
      callback: (timestamp: number, mediaTimeSeconds: number) => void,
    ) => PreviewPlaybackFrame | null;
    seek: (seconds: number, approximate: boolean, onSettled?: () => void) => void;
    setPlaybackRate: (rate: number) => void;
  };
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
  private unregisterMediaObserver: (() => void) | null = null;
  private playbackFrame: PreviewPlaybackFrame | null = null;
  private startupGeneration = 0;
  private lifecycle: "paused" | "starting" | "playing" = "paused";
  private mediaStartRequested = false;

  constructor(
    private driver: PlaybackDriver,
    durationMicros: number,
  ) {
    this.snapshot = { durationMicros, isPlaying: false, positionMicros: 0 };
  }

  updateDriver = (driver: PlaybackDriver) => {
    this.driver = driver;
  };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  connect = () => {
    const driver = this.driver;
    driver.preview.setPlaybackRate(1);
    driver.audio.setPlaybackRate(1);
    this.unregisterMediaObserver = driver.preview.registerMediaObserver({
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

        if (!isExpectedPlay) this.driver.preview.pause();
      },
      onPlaybackError: () => this.pause(),
      onTimeUpdate: (seconds) => {
        if (!this.snapshot.isPlaying) this.publishMediaTime(seconds, false);
      },
    });

    return () => {
      this.unregisterMediaObserver?.();
      this.unregisterMediaObserver = null;
      this.cancelStartup();
      this.lifecycle = "paused";
      this.stopPlaybackClock();
      driver.preview.pause();
      driver.audio.pause();
    };
  };

  seek = (positionMicros: number) => {
    if (this.lifecycle === "starting") {
      this.cancelStartup();
      this.driver.preview.pause();
      this.driver.audio.pause();
    }
    const nextPosition = Math.max(0, Math.min(this.snapshot.durationMicros, positionMicros));
    if (!Number.isFinite(nextPosition)) return;
    this.setPosition(nextPosition);
    const seconds = nextPosition / MICROS_PER_SECOND;
    this.driver.audio.syncTo(seconds, true);
    this.driver.preview.seek(seconds, false);
  };

  play = () => {
    const driver = this.driver;
    if (
      !driver.preview.isReady ||
      (driver.audio.usesWebAudio && !driver.audio.isReady) ||
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
    driver.preview.setPlaybackRate(1);
    driver.audio.setPlaybackRate(1);
    void this.startPlayback(generation, seconds);
  };

  pause = () => {
    this.cancelStartup();
    this.lifecycle = "paused";
    this.stopPlaybackClock();
    this.driver.preview.pause();
    this.driver.audio.pause();
    this.setIsPlaying(false);
  };

  togglePlayback = () => {
    if (this.snapshot.isPlaying || this.lifecycle === "starting") this.pause();
    else this.play();
  };

  private publishMediaTime(seconds: number, synchronizeAudio = true) {
    if (this.driver.preview.isSeekPending()) return;
    this.setPosition(seconds * MICROS_PER_SECOND);
    if (synchronizeAudio) this.driver.audio.syncTo(seconds);
  }

  private async startPlayback(generation: number, seconds: number) {
    try {
      await this.driver.audio.resumeAudioContext();
      if (!this.isCurrentStartup(generation)) return;

      await new Promise<void>((resolve) => {
        this.driver.preview.seek(seconds, false, resolve);
      });
      if (!this.isCurrentStartup(generation)) return;

      await this.driver.audio.startAt(seconds);
      if (!this.isCurrentStartup(generation)) return;

      this.mediaStartRequested = true;
      await this.driver.preview.play();
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
      if (!this.driver.preview.isSeekPending()) {
        this.publishMediaTime(clockSeconds, false);
        if (audioClockSeconds !== null) this.driver.audio.syncTo(clockSeconds);
        if (this.snapshot.positionMicros >= this.snapshot.durationMicros) {
          this.pause();
          return;
        }
      }
      this.playbackFrame = this.requestPlaybackFrame(tick);
    };

    this.playbackFrame = this.requestPlaybackFrame(tick);
  }

  private requestPlaybackFrame(callback: (timestamp: number, mediaTimeSeconds: number) => void) {
    return this.driver.audio.usesWebAudio
      ? this.driver.audio.requestPlaybackFrame(callback)
      : this.driver.preview.requestPlaybackFrame(callback);
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
