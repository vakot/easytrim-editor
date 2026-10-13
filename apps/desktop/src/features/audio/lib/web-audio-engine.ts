import type { AudioTrackHighPass, AudioTrackSelection } from "@/domain/audio-processing";

import {
  connectAudioTrackRuntime,
  connectPlaybackAudioGraph,
  disconnectAudioTrackRuntime,
  updateAudioTrackHighPass,
} from "./audio-playback-graph";
import { disconnectStereoAudioMeterNodes, type StereoAudioMeterNodes } from "./stereo-audio-meter";

const SAMPLE_RATE = 48_000;
const PCM_CHUNK_FRAMES = SAMPLE_RATE * 2;
const MAX_BUFFER_AHEAD_FRAMES = SAMPLE_RATE * 4;
const START_LEAD_SECONDS = 0.15;
const MIN_SCHEDULE_LEAD_SECONDS = 0.005;
const CHANNELS = 2;

interface PcmChunk {
  channels: number;
  sampleRate: number;
  samples: number[];
}

interface WebAudioTrack {
  gainDb: number;
  liveHighPassEffects: AudioTrackHighPass[];
  selection: AudioTrackSelection;
  streamIndex: number;
}

type DecodeChunk = (
  selection: AudioTrackSelection,
  startMicros: number,
  durationMicros: number,
  signal: AbortSignal,
) => Promise<PcmChunk>;

interface SampleRange {
  endFrame: number;
  startFrame: number;
}

interface DecodedSampleRange extends SampleRange {
  buffer: AudioBuffer;
  track: ScheduledTrack;
}

interface ScheduledTrack {
  abortController: AbortController | null;
  cursorFrame: number;
  gain: GainNode;
  generation: number;
  highPassFilters: ReturnType<typeof connectAudioTrackRuntime>["highPassFilters"];
  input: GainNode;
  liveHighPassKey: string;
  nodes: Set<AudioBufferSourceNode>;
  scheduledThroughFrame: number;
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
  private anchorPositionFrame = 0;
  private durationMicros = 0;
  private generation = 0;
  private isPlaying = false;
  private nextScheduledFrame = 0;
  private nextScheduledContextTime = 0;
  private playbackRate = 1;
  private pumpFrame: number | null = null;
  private batchInFlight = false;

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
    return this.currentPositionFrame() / SAMPLE_RATE;
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
  }

  setMono(mono: boolean): void {
    this.audioMeter.isMono = mono;
  }

  setTracks(tracks: WebAudioTrack[]): void {
    const incoming = new Map(tracks.map((track) => [track.streamIndex, track]));
    const playbackPositionFrame = this.currentPositionFrame();
    let membershipChanged = incoming.size !== this.tracks.size;
    for (const [streamIndex, scheduled] of this.tracks) {
      if (incoming.has(streamIndex)) continue;
      membershipChanged = true;
      this.removeTrack(streamIndex, scheduled);
    }

    let processingChanged = false;
    for (const track of tracks) {
      const key = JSON.stringify(track.selection);
      const liveHighPassKey = JSON.stringify(track.liveHighPassEffects);
      const current = this.tracks.get(track.streamIndex);
      if (current && current.selectionKey !== key) {
        processingChanged = true;
        current.selection = track.selection;
        current.selectionKey = key;
      }

      const scheduled = current ?? this.createTrack(track, key, liveHighPassKey);
      const now = this.context.currentTime;
      if (current && scheduled.liveHighPassKey !== liveHighPassKey) {
        scheduled.liveHighPassKey = liveHighPassKey;
        updateAudioTrackHighPass(this.context, scheduled, track.liveHighPassEffects);
      }
      scheduled.gain.gain.cancelScheduledValues(now);
      scheduled.gain.gain.setTargetAtTime(10 ** (track.gainDb / 20), now, 0.015);
    }

    if (this.isPlaying && this.hasTracks && (membershipChanged || processingChanged)) {
      this.seek(playbackPositionFrame / SAMPLE_RATE);
    } else if (this.isPlaying && this.hasTracks) {
      this.requestPump();
    } else {
      this.cancelPump();
    }
  }

  async startAt(seconds: number): Promise<void> {
    if (!this.hasTracks || this.durationFrames <= 0) return;
    this.generation += 1;
    const generation = this.generation;
    this.isPlaying = false;
    this.batchInFlight = true;
    this.cancelPump();
    this.stopSources();
    const startFrame = this.secondsToFrame(seconds);
    this.anchorPositionFrame = startFrame;
    this.nextScheduledFrame = startFrame;
    for (const track of this.tracks.values()) {
      track.generation = generation;
      track.cursorFrame = startFrame;
      track.scheduledThroughFrame = startFrame;
    }

    try {
      await this.context.resume();
      if (generation !== this.generation) return;

      const firstBatch = await this.decodeBatch(
        generation,
        startFrame,
        this.nextChunkEndFrame(startFrame),
      );

      if (generation !== this.generation) return;

      const scheduledStart = this.context.currentTime + START_LEAD_SECONDS;
      this.anchorContextTime = scheduledStart;
      this.anchorPositionFrame = startFrame;
      this.nextScheduledContextTime = scheduledStart;
      this.scheduleBatch(firstBatch, scheduledStart);
      this.isPlaying = true;
      this.batchInFlight = false;
      this.requestPump();
    } finally {
      if (generation === this.generation) this.batchInFlight = false;
    }
  }

  pause(): void {
    this.anchorPositionFrame = this.currentPositionFrame();
    this.isPlaying = false;
    this.generation += 1;
    this.batchInFlight = false;
    this.cancelPump();
    this.stopSources();
  }

  seek(seconds: number): void {
    const positionFrame = this.secondsToFrame(seconds);
    const resume = this.isPlaying;
    this.anchorPositionFrame = positionFrame;
    this.nextScheduledFrame = positionFrame;
    this.generation += 1;
    this.batchInFlight = false;
    this.cancelPump();
    this.stopSources();
    for (const track of this.tracks.values()) {
      track.generation = this.generation;
      track.cursorFrame = positionFrame;
      track.scheduledThroughFrame = positionFrame;
    }
    if (resume) void this.startAt(positionFrame / SAMPLE_RATE).catch(() => this.pause());
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0 || rate === this.playbackRate) return;
    const position = this.currentPositionFrame();
    this.playbackRate = rate;
    if (this.isPlaying) this.seek(position / SAMPLE_RATE);
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

  private get durationFrames(): number {
    return Math.max(0, Math.round((this.durationMicros * SAMPLE_RATE) / 1_000_000));
  }

  private createTrack(
    track: WebAudioTrack,
    selectionKey: string,
    liveHighPassKey: string,
  ): ScheduledTrack {
    const runtime = connectAudioTrackRuntime(this.context, this.audioMix);
    const scheduled: ScheduledTrack = {
      abortController: null,
      cursorFrame: this.anchorPositionFrame,
      generation: this.generation,
      gain: runtime.gain,
      highPassFilters: runtime.highPassFilters,
      liveHighPassKey,
      input: runtime.input,
      nodes: new Set(),
      scheduledThroughFrame: this.anchorPositionFrame,
      selectionKey,
      selection: track.selection,
      streamIndex: track.streamIndex,
    };

    updateAudioTrackHighPass(this.context, scheduled, track.liveHighPassEffects);
    this.tracks.set(track.streamIndex, scheduled);
    return scheduled;
  }

  private async decodeBatch(
    generation: number,
    startFrame: number,
    endFrame: number,
  ): Promise<DecodedSampleRange[]> {
    if (endFrame <= startFrame) return [];
    const tracks = [...this.tracks.values()];
    const decoded = await Promise.all(
      tracks.map((track) => this.decodeNext(track, generation, startFrame, endFrame)),
    );

    if (generation !== this.generation) return [];
    if (decoded.length !== tracks.length || decoded.some((range) => !range)) {
      throw new Error("Audio tracks did not produce the same playback sample range.");
    }
    return decoded as DecodedSampleRange[];
  }

  private async decodeNext(
    track: ScheduledTrack,
    generation: number,
    startFrame: number,
    endFrame: number,
  ): Promise<DecodedSampleRange | null> {
    if (track.abortController || track.cursorFrame !== startFrame) return null;
    const controller = new AbortController();
    track.abortController = controller;
    try {
      const startMicros = this.frameToMicros(startFrame);
      const durationMicros = this.frameToMicros(endFrame - startFrame);
      const chunk = await this.decodeChunk(
        track.selection,
        startMicros,
        durationMicros,
        controller.signal,
      );

      if (
        controller.signal.aborted ||
        generation !== this.generation ||
        track.generation !== generation ||
        this.tracks.get(track.streamIndex) !== track
      ) {
        return null;
      }

      const frameCount = chunk.samples.length / chunk.channels;
      if (
        chunk.channels !== CHANNELS ||
        chunk.sampleRate !== SAMPLE_RATE ||
        !Number.isInteger(frameCount) ||
        frameCount !== endFrame - startFrame
      ) {
        throw new Error("Decoded audio did not match its requested sample range.");
      }

      const buffer = this.context.createBuffer(chunk.channels, frameCount, chunk.sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let frame = 0; frame < frameCount; frame += 1) {
        left[frame] = chunk.samples[frame * chunk.channels]! / 32768;
        right[frame] = chunk.samples[frame * chunk.channels + 1]! / 32768;
      }
      track.cursorFrame = endFrame;
      return { buffer, endFrame, startFrame, track };
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return null;
      throw error;
    } finally {
      if (track.abortController === controller) track.abortController = null;
    }
  }

  private scheduleBatch(batch: DecodedSampleRange[], contextStart: number): void {
    if (batch.length !== this.tracks.size || batch.length === 0) {
      throw new Error("Audio playback batch does not include every active track.");
    }
    const { endFrame, startFrame } = batch[0]!;
    if (startFrame !== this.nextScheduledFrame) {
      throw new Error("Audio playback sample ranges are not consecutive.");
    }
    for (const range of batch) {
      if (
        range.startFrame !== startFrame ||
        range.endFrame !== endFrame ||
        range.track.scheduledThroughFrame !== startFrame
      ) {
        throw new Error("Audio tracks cannot schedule different sample ranges.");
      }
    }

    let sharedStart = contextStart;
    const earliestSafeStart = this.context.currentTime + MIN_SCHEDULE_LEAD_SECONDS;
    if (sharedStart < earliestSafeStart) {
      // Underruns freeze the shared media clock at this boundary and resume every
      // active track together once all tracks have produced the range.
      sharedStart = this.context.currentTime + MIN_SCHEDULE_LEAD_SECONDS;
      this.anchorContextTime = sharedStart;
      this.anchorPositionFrame = startFrame;
    }

    for (const range of batch) this.schedule(range, sharedStart);
    this.nextScheduledFrame = endFrame;
    this.nextScheduledContextTime =
      sharedStart + (endFrame - startFrame) / SAMPLE_RATE / this.playbackRate;
  }

  private schedule(range: DecodedSampleRange, contextStart: number): void {
    const { buffer, endFrame, startFrame, track } = range;
    if (startFrame !== track.scheduledThroughFrame) {
      throw new Error("Audio buffer sample ranges contain a gap or overlap.");
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(track.input);
    source.onended = () => {
      source.disconnect();
      track.nodes.delete(source);
      if (this.currentPositionFrame() >= this.durationFrames && this.isPlaying) {
        this.pause();
        this.onEnded();
      }
    };
    source.start(contextStart);
    track.nodes.add(source);
    track.scheduledThroughFrame = endFrame;
  }

  private requestPump(): void {
    if (!this.isPlaying || this.pumpFrame !== null || this.batchInFlight) return;
    void this.pumpNextBatch(this.generation);
  }

  private async pumpNextBatch(generation: number): Promise<void> {
    if (!this.isPlaying || generation !== this.generation || this.batchInFlight) return;
    const horizonFrame = Math.min(
      this.durationFrames,
      this.currentPositionFrame() + MAX_BUFFER_AHEAD_FRAMES,
    );

    const startFrame = this.nextScheduledFrame;
    if (startFrame >= horizonFrame) {
      this.pumpFrame = window.setTimeout(() => {
        this.pumpFrame = null;
        void this.pumpNextBatch(generation);
      }, 100) as unknown as number;
      return;
    }

    const endFrame = this.nextChunkEndFrame(startFrame);
    this.batchInFlight = true;
    try {
      const batch = await this.decodeBatch(generation, startFrame, endFrame);
      if (!this.isPlaying || generation !== this.generation) return;
      this.scheduleBatch(batch, this.nextScheduledContextTime);
      if (this.currentPositionFrame() >= this.durationFrames) {
        this.pause();
        this.onEnded();
        return;
      }
    } catch {
      if (generation === this.generation) this.pause();
      return;
    } finally {
      if (generation === this.generation) this.batchInFlight = false;
    }
    this.requestPump();
  }

  private nextChunkEndFrame(startFrame: number): number {
    return Math.min(this.durationFrames, startFrame + PCM_CHUNK_FRAMES);
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

  private invalidateTrack(track: ScheduledTrack, positionFrame: number): void {
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
    track.cursorFrame = positionFrame;
    track.scheduledThroughFrame = positionFrame;
  }

  private removeTrack(streamIndex: number, track: ScheduledTrack): void {
    this.invalidateTrack(track, this.currentPositionFrame());
    disconnectAudioTrackRuntime(track);
    this.tracks.delete(streamIndex);
  }

  private currentPositionFrame(): number {
    if (!this.isPlaying) return Math.min(this.durationFrames, this.anchorPositionFrame);

    const elapsedFrames = Math.floor(
      Math.max(0, this.context.currentTime - this.anchorContextTime) *
        SAMPLE_RATE *
        this.playbackRate,
    );

    const scheduledFrames = Math.max(0, this.nextScheduledFrame - this.anchorPositionFrame);

    // The context clock can consume only the contiguous sample range already scheduled.
    return Math.min(
      this.durationFrames,
      this.anchorPositionFrame + Math.min(elapsedFrames, scheduledFrames),
    );
  }

  private secondsToFrame(seconds: number): number {
    return Math.min(this.durationFrames, Math.max(0, Math.round(seconds * SAMPLE_RATE)));
  }

  private frameToMicros(frame: number): number {
    return Math.round((frame * 1_000_000) / SAMPLE_RATE);
  }
}

export { WebAudioEngine };
export type { DecodeChunk, PcmChunk, WebAudioTrack };
