import type { PreviewPlaybackFrame } from "@/features/preview";

interface PlaybackDriver {
  isPreviewReady: boolean;
  isSeekPending: () => boolean;
  pause: () => void;
  pauseMedia: () => void;
  playMedia: () => Promise<void>;
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
  resumeAudioContext: () => Promise<void>;
  seekMedia: (seconds: number, approximate: boolean, onSettled?: () => void) => void;
  setPlaybackRate: (rate: number) => void;
  startAt: (seconds: number) => Promise<void[]>;
  syncTo: (seconds: number, force?: boolean) => void;
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
    driver.setPlaybackRate(1);
    this.unregisterMediaObserver = driver.registerMediaObserver({
      onEnded: () => {
        this.setPosition(this.snapshot.durationMicros);
        this.pause();
      },
      onPause: () => {
        this.stopPlaybackClock();
        this.driver.pause();
        this.setIsPlaying(false);
      },
      onPlay: () => this.setIsPlaying(true),
      onPlaybackError: () => this.pause(),
      onTimeUpdate: (seconds) => {
        if (!this.snapshot.isPlaying) this.publishMediaTime(seconds, false);
      },
    });

    return () => {
      this.unregisterMediaObserver?.();
      this.unregisterMediaObserver = null;
      this.stopPlaybackClock();
      driver.pauseMedia();
      driver.pause();
    };
  };

  seek = (positionMicros: number) => {
    const nextPosition = Math.max(0, Math.min(this.snapshot.durationMicros, positionMicros));
    if (!Number.isFinite(nextPosition)) return;
    this.setPosition(nextPosition);
    const seconds = nextPosition / MICROS_PER_SECOND;
    this.driver.seekMedia(seconds, false, () => this.driver.syncTo(seconds, true));
  };

  play = () => {
    const driver = this.driver;
    if (!driver.isPreviewReady || this.snapshot.durationMicros <= 0) return;
    if (this.snapshot.positionMicros >= this.snapshot.durationMicros) this.seek(0);

    const seconds = this.snapshot.positionMicros / MICROS_PER_SECOND;
    void driver.resumeAudioContext().catch(() => this.pause());
    driver.setPlaybackRate(1);
    void driver.startAt(seconds).catch(() => this.pause());
    void driver.playMedia().catch(() => this.pause());
  };

  pause = () => {
    this.stopPlaybackClock();
    this.driver.pauseMedia();
    this.driver.pause();
    this.setIsPlaying(false);
  };

  togglePlayback = () => {
    if (this.snapshot.isPlaying) this.pause();
    else this.play();
  };

  private publishMediaTime(seconds: number, synchronizeAudio = true) {
    if (this.driver.isSeekPending()) return;
    this.setPosition(seconds * MICROS_PER_SECOND);
    if (synchronizeAudio) this.driver.syncTo(seconds);
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
      if (!this.driver.isSeekPending()) this.publishMediaTime(seconds);
      this.playbackFrame = this.driver.requestPlaybackFrame(tick);
    };

    this.playbackFrame = this.driver.requestPlaybackFrame(tick);
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
