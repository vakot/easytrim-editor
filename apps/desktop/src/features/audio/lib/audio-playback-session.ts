import { decodeAudioPlaybackChunk } from "@/lib/tauri/media";

import { WebAudioEngine, type WebAudioTrack } from "./web-audio-engine";

class AudioPlaybackSession {
  private readonly context: AudioContext;
  private readonly engine: WebAudioEngine;
  private closed = false;
  private playbackErrorObserver: (() => void) | null = null;

  constructor(sourcePath: string) {
    this.context = new AudioContext();
    this.engine = new WebAudioEngine(
      this.context,
      (selection, startMicros, chunkDurationMicros, signal) =>
        decodeAudioPlaybackChunk(sourcePath, selection, startMicros, chunkDurationMicros, signal),
      () => undefined,
      () => this.playbackErrorObserver?.(),
    );
  }

  get meter() {
    return this.engine.meter;
  }

  get hasTracks() {
    return this.engine.hasTracks;
  }

  get currentTimeSeconds() {
    return this.engine.currentTimeSeconds;
  }

  setDuration(durationMicros: number) {
    this.engine.setDuration(durationMicros);
  }

  setTracks(tracks: WebAudioTrack[]) {
    this.engine.setTracks(tracks);
  }

  setOutputGain(linearGain: number) {
    this.engine.setOutputGain(linearGain);
  }

  setMono(mono: boolean) {
    this.engine.setMono(mono);
  }

  setTrackGain(streamIndex: number, gainDb: number) {
    this.engine.setTrackGain(streamIndex, gainDb);
  }

  pause() {
    this.engine.pause();
  }

  prepareAt(seconds: number) {
    return this.engine.prepareAt(seconds);
  }

  prefetchAt(seconds: number) {
    return this.engine.prefetchAt(seconds);
  }

  startAlignedWithVideoAt(videoPositionSeconds: number) {
    return this.engine.startAlignedWithVideoAt(videoPositionSeconds);
  }

  registerPlaybackErrorObserver(observer: () => void) {
    this.playbackErrorObserver = observer;
    return () => {
      if (this.playbackErrorObserver === observer) this.playbackErrorObserver = null;
    };
  }

  seek(seconds: number) {
    this.engine.seek(seconds);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.engine.close();
    void this.context.close().catch(() => undefined);
  }
}

export { AudioPlaybackSession };
