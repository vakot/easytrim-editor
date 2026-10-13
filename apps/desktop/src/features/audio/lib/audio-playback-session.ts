import { decodeAudioPlaybackChunk } from "@/lib/tauri/media";

import { WebAudioEngine, type WebAudioTrack } from "./web-audio-engine";

class AudioPlaybackSession {
  private readonly context: AudioContext;
  private readonly engine: WebAudioEngine;
  private closed = false;

  constructor(sourcePath: string) {
    this.context = new AudioContext();
    this.engine = new WebAudioEngine(
      this.context,
      (selection, startMicros, chunkDurationMicros, signal) =>
        decodeAudioPlaybackChunk(sourcePath, selection, startMicros, chunkDurationMicros, signal),
      () => undefined,
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

  startAt(seconds: number) {
    return this.engine.startAt(seconds);
  }

  seek(seconds: number) {
    this.engine.seek(seconds);
  }

  setPlaybackRate(rate: number) {
    this.engine.setPlaybackRate(rate);
  }

  resume() {
    return this.engine.resumeAudioContext();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.engine.close();
    void this.context.close().catch(() => undefined);
  }
}

export { AudioPlaybackSession };
