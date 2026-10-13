import type { AudioTrackLimiter, AudioTrackSelection } from "@/domain/audio-processing";

import {
  connectPlaybackAudioGraph,
  disconnectAudioTrackRuntime,
  updateAudioTrackLimiter,
} from "./audio-playback-graph";
import { disconnectStereoAudioMeterNodes, type StereoAudioMeterNodes } from "./stereo-audio-meter";

const PCM_CHUNK_MICROS = 2_000_000;
const MAX_BUFFER_AHEAD_SECONDS = 4;
const START_LEAD_SECONDS = 0.15;
const CHANNELS = 2;

interface PcmChunk {
  channels: number;
  sampleRate: number;
  samples: number[];
}

interface WebAudioTrack {
  gainDb: number;
  limiterProcessing?: AudioTrackLimiter;
  selection: AudioTrackSelection;
  streamIndex: number;
}

type DecodeChunk = (
  selection: AudioTrackSelection,
  startMicros: number,
  durationMicros: number,
  signal: AbortSignal,
) => Promise<PcmChunk>;

interface ScheduledTrack {
  abortController: AbortController | null;
  cursorMicros: number;
  gain: GainNode;
  generation: number;
  limiter: WaveShaperNode | null;
  limiterKey: string;
  limiterProcessing?: AudioTrackLimiter;
  nodes: Set<AudioBufferSourceNode>;
  scheduledThrough: number;
  selection: AudioTrackSelection;
  selectionKey: string;
  streamIndex: number;
}

class WebAudioEngine {
  private readonly audioMix: GainNode;
  private readonly audioMeter: StereoAudioMeterNodes;
  private readonly outputGain: GainNode;
  private readonly tracks = new Map<number, ScheduledTrack>();
  private anchorContextTime = 0;
  private anchorPositionMicros = 0;
  private durationMicros = 0;
  private generation = 0;
  private isPlaying = false;
  private playbackRate = 1;
  private pumpFrame: number | null = null;

  constructor(
    private readonly context: AudioContext,
    private readonly decodeChunk: DecodeChunk,
    private readonly onEnded: () => void,
  ) {
    this.audioMix = context.createGain();
    const graph = connectPlaybackAudioGraph(context, this.audioMix);
    this.audioMeter = graph.meter;
    this.outputGain = graph.outputGain;
  }

  get meter(): StereoAudioMeterNodes {
    return this.audioMeter;
  }

  get hasTracks(): boolean {
    return this.tracks.size > 0;
  }

  get currentTimeSeconds(): number {
    if (!this.isPlaying) return this.anchorPositionMicros / 1_000_000;
    const elapsedSeconds = Math.max(0, this.context.currentTime - this.anchorContextTime);
    return Math.min(
      this.durationMicros / 1_000_000,
      this.anchorPositionMicros / 1_000_000 + elapsedSeconds * this.playbackRate,
    );
  }

  setDuration(durationMicros: number): void {
    this.durationMicros = Math.max(0, durationMicros);
  }

  setOutputGain(linearGain: number): void {
    const now = this.context.currentTime;
    this.outputGain.gain.cancelScheduledValues(now);
    this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
    this.outputGain.gain.linearRampToValueAtTime(linearGain, now + 0.025);
  }

  setTrackGain(streamIndex: number, gainDb: number): void {
    const track = this.tracks.get(streamIndex);
    if (!track) return;
    track.gain.gain.setTargetAtTime(10 ** (gainDb / 20), this.context.currentTime, 0.015);
    updateAudioTrackLimiter(
      this.context,
      track,
      this.audioMix,
      track.limiterProcessing,
    );
  }

  setMono(mono: boolean): void {
    this.audioMeter.isMono = mono;
  }

  setTracks(tracks: WebAudioTrack[]): void {
    const incoming = new Map(tracks.map((track) => [track.streamIndex, track]));
    const playbackPositionMicros = this.currentPositionMicros();
    for (const [streamIndex, scheduled] of this.tracks) {
      if (!incoming.has(streamIndex)) this.removeTrack(streamIndex, scheduled);
    }

    let processingChanged = false;
    for (const track of tracks) {
      const key = JSON.stringify(track.selection);
      const limiterKey = JSON.stringify(track.limiterProcessing ?? null);
      const current = this.tracks.get(track.streamIndex);
      if (current && current.selectionKey !== key) {
        processingChanged = true;
        current.selection = track.selection;
        current.selectionKey = key;
      }

      const scheduled = current ?? this.createTrack(track, key, limiterKey);
      const now = this.context.currentTime;
      if (current && current.limiterKey !== limiterKey) {
        scheduled.limiterKey = limiterKey;
        scheduled.limiterProcessing = track.limiterProcessing;
        updateAudioTrackLimiter(this.context, scheduled, this.audioMix, track.limiterProcessing);
      }
      if (!current && this.isPlaying) {
        scheduled.cursorMicros = playbackPositionMicros;
        scheduled.scheduledThrough = now + START_LEAD_SECONDS;
      }
      scheduled.gain.gain.cancelScheduledValues(now);
      scheduled.gain.gain.setTargetAtTime(10 ** (track.gainDb / 20), now, 0.015);
    }

    if (processingChanged && this.isPlaying) this.seek(this.currentTimeSeconds);
    if (this.isPlaying && this.hasTracks) {
      this.cancelPump();
      this.requestPump();
    } else {
      this.cancelPump();
    }
  }

  async startAt(seconds: number): Promise<void> {
    if (!this.hasTracks || this.durationMicros <= 0) return;
    await this.context.resume();
    this.stopSources();
    this.generation += 1;
    const generation = this.generation;
    const positionMicros = Math.max(0, Math.min(this.durationMicros, Math.round(seconds * 1_000_000)));
    this.anchorPositionMicros = positionMicros;
    this.isPlaying = false;
    for (const track of this.tracks.values()) {
      track.generation = generation;
      track.cursorMicros = positionMicros;
      track.scheduledThrough = this.context.currentTime + START_LEAD_SECONDS;
    }

    const primed = await Promise.all(
      [...this.tracks.values()].map(async (track) => ({
        buffer: await this.decodeNext(track, generation),
        track,
      })),
    );

    if (generation !== this.generation) return;
    this.isPlaying = true;
    const startAt = this.context.currentTime + START_LEAD_SECONDS;
    this.anchorContextTime = startAt;
    this.anchorPositionMicros = positionMicros;
    for (const item of primed) {
      if (item.buffer && this.tracks.get(item.track.streamIndex) === item.track) {
        this.schedule(item.track, item.buffer, startAt);
      }
    }
    this.requestPump();
  }

  pause(): void {
    this.anchorPositionMicros = this.currentPositionMicros();
    this.isPlaying = false;
    this.generation += 1;
    this.cancelPump();
    this.stopSources();
  }

  seek(seconds: number): void {
    const positionMicros = Math.max(0, Math.min(this.durationMicros, Math.round(seconds * 1_000_000)));
    const resume = this.isPlaying;
    this.anchorPositionMicros = positionMicros;
    this.generation += 1;
    this.cancelPump();
    this.stopSources();
    for (const track of this.tracks.values()) {
      track.generation = this.generation;
      track.cursorMicros = positionMicros;
      track.scheduledThrough = this.context.currentTime + START_LEAD_SECONDS;
    }
    if (resume) void this.startAt(positionMicros / 1_000_000).catch(() => this.pause());
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0 || rate === this.playbackRate) return;
    const position = this.currentPositionMicros();
    this.playbackRate = rate;
    if (this.isPlaying) this.seek(position / 1_000_000);
  }

  async resumeAudioContext(): Promise<void> {
    await this.context.resume();
  }

  close(): void {
    this.pause();
    for (const [streamIndex, track] of this.tracks) this.removeTrack(streamIndex, track);
    disconnectStereoAudioMeterNodes(this.audioMeter);
    this.audioMix.disconnect();
    this.outputGain.disconnect();
  }

  private createTrack(
    track: WebAudioTrack,
    selectionKey: string,
    limiterKey: string,
  ): ScheduledTrack {
    const gain = this.context.createGain();
    const scheduled: ScheduledTrack = {
      abortController: null,
      cursorMicros: this.anchorPositionMicros,
      generation: this.generation,
      gain,
      limiter: null,
      limiterKey,
      limiterProcessing: track.limiterProcessing,
      nodes: new Set(),
      scheduledThrough: this.context.currentTime,
      selectionKey,
      selection: track.selection,
      streamIndex: track.streamIndex,
    };

    gain.connect(this.audioMix);
    updateAudioTrackLimiter(
      this.context,
      scheduled,
      this.audioMix,
      track.limiterProcessing,
    );
    this.tracks.set(track.streamIndex, scheduled);
    return scheduled;
  }

  private async decodeNext(track: ScheduledTrack, generation: number) {
    if (track.abortController || track.cursorMicros >= this.durationMicros) return null;
    const startMicros = track.cursorMicros;
    const durationMicros = Math.min(PCM_CHUNK_MICROS, this.durationMicros - startMicros);
    const controller = new AbortController();
    track.abortController = controller;
    try {
      let chunk: PcmChunk;
      try {
        chunk = await this.decodeChunk(track.selection, startMicros, durationMicros, controller.signal);
      } catch (error) {
        if (
          controller.signal.aborted ||
          generation !== this.generation ||
          this.tracks.get(track.streamIndex) !== track
        ) {
          return null;
        }
        throw error;
      }
      if (
        controller.signal.aborted ||
        generation !== this.generation ||
        track.generation !== generation ||
        this.tracks.get(track.streamIndex) !== track
      ) {
        return null;
      }
      const frameCount = Math.floor(chunk.samples.length / chunk.channels);
      if (frameCount === 0 || chunk.channels !== CHANNELS) {
        track.cursorMicros = this.durationMicros;
        return null;
      }
      const buffer = this.context.createBuffer(chunk.channels, frameCount, chunk.sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let frame = 0; frame < frameCount; frame += 1) {
        left[frame] = chunk.samples[frame * chunk.channels]! / 32768;
        right[frame] = chunk.samples[frame * chunk.channels + 1]! / 32768;
      }
      track.cursorMicros += Math.round((frameCount / chunk.sampleRate) * 1_000_000);
      return buffer;
    } finally {
      if (track.abortController === controller) track.abortController = null;
    }
  }

  private schedule(track: ScheduledTrack, buffer: AudioBuffer, contextStart: number): void {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(track.gain);
    source.onended = () => {
      source.disconnect();
      track.nodes.delete(source);
      if (this.currentPositionMicros() >= this.durationMicros && this.isPlaying) {
        this.pause();
        this.onEnded();
      }
    };
    const scheduledStart = Math.max(contextStart, this.context.currentTime + 0.005);
    source.start(scheduledStart);
    track.nodes.add(source);
    track.scheduledThrough = scheduledStart + buffer.duration / this.playbackRate;
  }

  private requestPump(): void {
    if (!this.isPlaying || this.pumpFrame !== null) return;
    const pump = () => {
      this.pumpFrame = null;
      if (!this.isPlaying) return;
      const generation = this.generation;
      const horizon = this.context.currentTime + MAX_BUFFER_AHEAD_SECONDS;
      for (const track of this.tracks.values()) {
        if (track.abortController || track.cursorMicros >= this.durationMicros) continue;
        if (track.scheduledThrough >= horizon) continue;
        void this.decodeNext(track, generation).then((buffer) => {
          if (!buffer || !this.isPlaying || generation !== this.generation) return;
          this.schedule(track, buffer, track.scheduledThrough);
        }).catch(() => this.pause());
      }
      if (this.currentPositionMicros() >= this.durationMicros) {
        this.pause();
        this.onEnded();
        return;
      }
      this.pumpFrame = window.setTimeout(pump, 250) as unknown as number;
    };

    pump();
  }

  private cancelPump(): void {
    if (this.pumpFrame === null) return;
    window.clearTimeout(this.pumpFrame);
    this.pumpFrame = null;
  }

  private stopSources(): void {
    for (const track of this.tracks.values()) {
      track.abortController?.abort();
      track.abortController = null;
      for (const source of track.nodes) {
        source.onended = null;
        try {
          source.stop();
        } catch {
          // A source may already have ended between the scheduled check and stop.
        }
        source.disconnect();
      }
      track.nodes.clear();
    }
  }

  private invalidateTrack(track: ScheduledTrack, positionMicros: number): void {
    track.abortController?.abort();
    track.abortController = null;
    for (const source of track.nodes) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // A source may already have ended between the scheduled check and stop.
      }
      source.disconnect();
    }
    track.nodes.clear();
    track.generation = this.generation;
    track.cursorMicros = positionMicros;
    track.scheduledThrough = this.context.currentTime + START_LEAD_SECONDS;
  }

  private removeTrack(streamIndex: number, track: ScheduledTrack): void {
    this.invalidateTrack(track, this.currentPositionMicros());
    disconnectAudioTrackRuntime(track);
    this.tracks.delete(streamIndex);
  }

  private currentPositionMicros(): number {
    return Math.min(
      this.durationMicros,
      this.anchorPositionMicros +
        Math.max(0, this.context.currentTime - this.anchorContextTime) * this.playbackRate * 1_000_000,
    );
  }
}

export { WebAudioEngine };
export type { DecodeChunk, PcmChunk, WebAudioTrack };
