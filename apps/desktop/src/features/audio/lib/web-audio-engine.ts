import type { AudioChainSelection } from "@/domain/audio-processing";

import {
  connectAudioTrackRuntime,
  connectPlaybackAudioGraph,
  disconnectAudioTrackRuntime,
} from "./audio-playback-graph";
import { disconnectStereoAudioMeterNodes, type StereoAudioMeterNodes } from "./stereo-audio-meter";

const SAMPLE_RATE = 48_000;
const PCM_CHUNK_FRAMES = SAMPLE_RATE * 2;
const MAX_BUFFER_AHEAD_FRAMES = SAMPLE_RATE * 4;
const MIN_SCHEDULE_LEAD_SECONDS = 0.005;
const CHANNELS = 2;
/** How far ahead of the scheduling clock a processing change starts rendering its new chain. */
const PROCESSING_CHANGE_LEAD_SECONDS = 0.05;
/** A processing change switches only with this much new audio left, so the pump can follow. */
const PROCESSING_CHANGE_MIN_FRAMES = SAMPLE_RATE / 4;
/** Linear crossfade between the old and new processing; both carry the same source signal. */
const PROCESSING_CROSSFADE_SECONDS = 0.03;

interface PcmChunk {
  channels: number;
  sampleRate: number;
  samples: Float32Array;
}

interface WebAudioTrack {
  durationMicros?: number;
  /** Whether `selection` auditions a draft chain; its native audio stays temporary. */
  preview?: boolean;
  /** The processed chain; FFmpeg renders every filter so playback matches export. */
  selection: AudioChainSelection;
  startTimeMicros?: number;
  streamIndex: number;
  syncOffsetMicros?: number;
  /** An opaque label passed back with this track's render status. */
  tag?: number;
  /** Post-filter Track Volume, applied by the track's GainNode. */
  volume: number;
}

/**
 * Whether a track's requested processing is audible. `preparing` renders it for a start or seek,
 * `updating` renders it to replace different processing that keeps playing meanwhile, and
 * `failed` keeps the earlier preview audio. `ready` also covers a paused track whose processing
 * is rendered when playback starts.
 */
type TrackRenderStatus = "failed" | "preparing" | "ready" | "updating";

type TrackRenderStatusObserver = (
  streamIndex: number,
  tag: number | undefined,
  status: TrackRenderStatus,
) => void;

/**
 * `preview` audio auditions a draft chain. A `replacement` renders processing that will replace
 * the audible processing, which keeps rendering until playback switches.
 */
interface DecodeRole {
  preview: boolean;
  replacement: boolean;
}

type DecodeChunk = (
  selection: AudioChainSelection,
  startMicros: number,
  durationMicros: number,
  signal: AbortSignal,
  role: DecodeRole,
) => Promise<PcmChunk>;

/** A running processing change and the renders of its replacement processing. */
interface ProcessingChange {
  controllers: Set<AbortController>;
}

/** One processed chain of a track, as requested from the native renderer. */
interface TrackRender {
  key: string;
  offsetFrames: number;
  preview: boolean;
  selection: AudioChainSelection;
}

interface SampleRange {
  endFrame: number;
  startFrame: number;
}

interface DecodedSampleRange extends SampleRange {
  buffer: AudioBuffer;
  render: TrackRender;
  track: ScheduledTrack;
}

/** A preview chain failed to render, and earlier audio of its track can stand in for it. */
class PreviewRenderFailure extends Error {}

/** The sources of one processing run of a track, faded as a unit when the processing changes. */
interface TrackVoice {
  gain: GainNode;
  retired: boolean;
  sources: Set<AudioBufferSourceNode>;
}

interface PreparedAudioBatch {
  batch: DecodedSampleRange[];
  generation: number;
}

/** A decoded start chunk kept outside the playback generations, e.g. a loop's restart point. */
interface PrefetchedAudioChunk {
  endFrame: number;
  ranges: { buffer: AudioBuffer; key: string; render: TrackRender; track: ScheduledTrack }[];
  startFrame: number;
}

interface ScheduledTrack {
  abortController: AbortController | null;
  /** The processing whose audio was last decoded for playback. */
  audible: TrackRender | null;
  cursorFrame: number;
  durationFrame: number;
  /** A preview selection whose rendering failed; earlier audio stands in until it changes. */
  failedKey: string | null;
  gain: GainNode;
  generation: number;
  input: GainNode;
  nodes: Set<AudioBufferSourceNode>;
  offsetFrames: number;
  preview: boolean;
  retiredVoices: Set<TrackVoice>;
  scheduledThroughFrame: number;
  selection: AudioChainSelection;
  selectionKey: string;
  startFrame: number;
  status: TrackRenderStatus;
  streamIndex: number;
  tag: number | undefined;
  voice: TrackVoice;
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
  /** Source seconds played per context second; the sources resample, so the pitch follows it. */
  private playbackRate = 1;
  private isPlaying = false;
  private playbackRequested = false;
  private nextScheduledFrame = 0;
  private nextScheduledContextTime = 0;
  private pumpFrame: number | null = null;
  private batchInFlight = false;
  private preparedBatch: PreparedAudioBatch | null = null;
  private prefetched: PrefetchedAudioChunk | null = null;
  private prefetchRequest: { controller: AbortController; startFrame: number } | null = null;
  /** The last prefetched restart point, prefetched again once changed processing is audible. */
  private prefetchSeconds: number | null = null;
  /** A preparation that restarts with the new processing when it changes meanwhile. */
  private preparation: object | null = null;
  /** The running processing change, while its replacement processing renders. */
  private processingChange: ProcessingChange | null = null;

  constructor(
    private readonly context: AudioContext,
    private readonly decodeChunk: DecodeChunk,
    private readonly onEnded: () => void,
    private readonly onPlaybackError: () => void = () => undefined,
    private readonly onTrackStatus: TrackRenderStatusObserver = () => undefined,
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
    const next = Math.max(0, durationMicros);
    if (next !== this.durationMicros) this.discardPrefetch();
    this.durationMicros = next;
  }

  setOutputGain(linearGain: number): void {
    const now = this.context.currentTime;
    this.outputGain.gain.cancelScheduledValues(now);
    this.outputGain.gain.setValueAtTime(this.outputGain.gain.value, now);
    this.outputGain.gain.linearRampToValueAtTime(linearGain, now + 0.025);
  }

  /** Restarts a running playback from its current position at the new rate. */
  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0 || rate === this.playbackRate) return;
    const positionFrame = this.currentPositionFrame();
    const resume = this.playbackRequested || this.isPlaying;
    this.playbackRate = rate;
    if (resume) this.seek(positionFrame / SAMPLE_RATE);
  }

  /** Ramps Track Volume smoothly; it never changes the decoded, processed PCM. */
  setTrackVolume(streamIndex: number, volume: number): void {
    const track = this.tracks.get(streamIndex);
    if (!track) return;
    track.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.015);
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
    let timingChanged = false;
    let rangeChanged = false;
    const statusChanged: ScheduledTrack[] = [];
    for (const track of tracks) {
      const offsetFrames = Math.round(((track.syncOffsetMicros ?? 0) * SAMPLE_RATE) / 1_000_000);
      // Offset moves processed samples on the timeline; only the selection identifies processing.
      const key = JSON.stringify(track.selection);
      const current = this.tracks.get(track.streamIndex);
      const startFrame = Math.max(
        0,
        Math.round(((track.startTimeMicros ?? 0) * SAMPLE_RATE) / 1_000_000),
      );

      const durationFrame =
        track.durationMicros === undefined
          ? this.durationFrames
          : Math.min(
              this.durationFrames,
              Math.round(
                (((track.startTimeMicros ?? 0) + track.durationMicros) * SAMPLE_RATE) / 1_000_000,
              ),
            );

      if (current && current.selectionKey !== key) {
        processingChanged = true;
        current.selection = track.selection;
        current.selectionKey = key;
        if (current.failedKey !== key) current.failedKey = null;
        statusChanged.push(current);
      }
      if (current && current.offsetFrames !== offsetFrames) {
        timingChanged = true;
        current.offsetFrames = offsetFrames;
      }
      if (current && current.tag !== track.tag) {
        current.tag = track.tag;
        statusChanged.push(current);
      }
      if (current) {
        current.preview = track.preview ?? false;
        // Applying an auditioned draft keeps its audio playing as committed audio.
        if (current.audible?.key === key && current.audible.preview !== current.preview) {
          current.audible = { ...current.audible, preview: current.preview };
        }
      }

      if (
        current &&
        (current.startFrame !== startFrame || current.durationFrame !== durationFrame)
      ) {
        rangeChanged = true;
        current.startFrame = startFrame;
        current.durationFrame = durationFrame;
      }

      const scheduled = current ?? this.createTrack(track, key);
      const now = this.context.currentTime;
      scheduled.gain.gain.cancelScheduledValues(now);
      scheduled.gain.gain.setTargetAtTime(track.volume, now, 0.015);
    }

    if (membershipChanged || rangeChanged || processingChanged) this.discardPrefetch();
    if (this.isPlaying && this.hasTracks && (membershipChanged || rangeChanged)) {
      this.preparedBatch = null;
      this.seek(playbackPositionFrame / SAMPLE_RATE);
    } else if (this.isPlaying && this.hasTracks && processingChanged) {
      this.changeProcessing();
    } else if (this.isPlaying && this.hasTracks && timingChanged) {
      this.preparedBatch = null;
      if (this.processingChange !== null) this.changeProcessing();
      else this.seek(playbackPositionFrame / SAMPLE_RATE);
    } else if (this.isPlaying && this.hasTracks) {
      this.requestPump();
    } else if (
      this.playbackRequested &&
      this.hasTracks &&
      (membershipChanged || rangeChanged || processingChanged || timingChanged)
    ) {
      // A start is still decoding the previous chain or placement; start again with the new one.
      this.seek(this.anchorPositionFrame / SAMPLE_RATE);
    } else {
      if (membershipChanged || rangeChanged || processingChanged || timingChanged) {
        this.generation += 1;
        this.batchInFlight = false;
        this.preparedBatch = null;
        this.stopSources();
        for (const track of this.tracks.values()) {
          track.generation = this.generation;
          track.cursorFrame = playbackPositionFrame;
          track.scheduledThroughFrame = playbackPositionFrame;
        }
      }
      this.cancelPump();
    }
    for (const track of statusChanged) this.reportStatus(track, this.pendingStatus(track), true);
  }

  async startAt(seconds: number, contextStart?: number): Promise<void> {
    if (!this.hasTracks || this.durationFrames <= 0) return;
    this.playbackRequested = true;
    this.preparation = null;
    this.cancelProcessingChange();
    const startFrame = this.secondsToFrame(seconds);
    const prepared = this.preparedBatch;
    const canUsePreparedBatch =
      prepared?.generation === this.generation &&
      prepared.batch.length > 0 &&
      startFrame >= prepared.batch[0]!.startFrame &&
      startFrame < prepared.batch[0]!.endFrame;

    if (!canUsePreparedBatch) this.generation += 1;
    const generation = this.generation;
    this.isPlaying = false;
    this.batchInFlight = true;
    this.cancelPump();
    this.stopSources();
    this.preparedBatch = null;
    this.anchorPositionFrame = startFrame;
    this.nextScheduledFrame = startFrame;
    for (const track of this.tracks.values()) {
      track.generation = generation;
      track.scheduledThroughFrame = startFrame;
      if (!canUsePreparedBatch) track.cursorFrame = startFrame;
    }
    this.refreshStatuses();

    try {
      if (!canUsePreparedBatch) await this.context.resume();
      if (generation !== this.generation) return;

      const firstBatch = canUsePreparedBatch
        ? prepared.batch
        : await this.decodeStartBatch(generation, startFrame);

      if (generation !== this.generation) return;

      const scheduledStart = contextStart ?? this.context.currentTime + MIN_SCHEDULE_LEAD_SECONDS;
      this.anchorContextTime = scheduledStart;
      this.anchorPositionFrame = startFrame;
      this.nextScheduledContextTime = scheduledStart;
      if (canUsePreparedBatch) {
        this.schedulePreparedBatch(firstBatch, startFrame, scheduledStart);
      } else {
        this.scheduleBatch(firstBatch, scheduledStart);
      }
      this.isPlaying = true;
      this.batchInFlight = false;
      this.requestPump();
    } finally {
      if (generation === this.generation) {
        this.batchInFlight = false;
        this.refreshStatuses();
      }
    }
  }

  startPreparedAt(seconds: number, contextStart?: number): Promise<void> {
    if (!this.hasTracks || this.durationFrames <= 0) return Promise.resolve();
    const startFrame = this.secondsToFrame(seconds);
    const firstRange = this.preparedBatch?.batch[0];
    if (
      this.preparedBatch?.generation !== this.generation ||
      !firstRange ||
      startFrame < firstRange.startFrame ||
      startFrame >= firstRange.endFrame
    ) {
      return Promise.reject(
        new Error("Prepared audio does not cover the requested start position."),
      );
    }
    return this.startAt(seconds, contextStart);
  }

  async startAlignedWithVideoAt(videoPositionSeconds: number): Promise<number> {
    if (!this.hasTracks) return videoPositionSeconds;
    const contextStart = this.context.currentTime + MIN_SCHEDULE_LEAD_SECONDS;
    const startFrame = this.secondsToFrame(
      videoPositionSeconds +
        Math.max(0, contextStart - this.outputContextTime()) * this.playbackRate,
    );

    // If output latency consumes the remaining range, there are no audible samples
    // left to schedule. Native video completion still owns the terminal EOF state.
    if (startFrame >= this.durationFrames) {
      this.pause();
      this.anchorPositionFrame = this.durationFrames;
      this.nextScheduledFrame = this.durationFrames;
      return this.durationFrames / SAMPLE_RATE;
    }
    const audioStartPosition = startFrame / SAMPLE_RATE;
    await this.startPreparedAt(audioStartPosition, contextStart);

    return audioStartPosition;
  }

  /**
   * Decodes the first chunk at `seconds` for a start that is aligned later. When the processing
   * changes meanwhile, the chunk is prepared again with the new processing instead of failing.
   */
  async prepareAt(seconds: number): Promise<void> {
    if (!this.hasTracks || this.durationFrames <= 0) return;
    const preparation = {};
    this.preparation = preparation;
    this.playbackRequested = false;
    this.cancelProcessingChange();
    const startFrame = this.secondsToFrame(seconds);
    for (;;) {
      this.generation += 1;
      const generation = this.generation;
      this.isPlaying = false;
      this.batchInFlight = true;
      this.preparedBatch = null;
      this.cancelPump();
      this.stopSources();
      this.anchorPositionFrame = startFrame;
      this.nextScheduledFrame = startFrame;
      for (const track of this.tracks.values()) {
        track.generation = generation;
        track.cursorFrame = startFrame;
        track.scheduledThroughFrame = startFrame;
      }
      this.refreshStatuses();

      try {
        await this.context.resume();
        if (generation === this.generation) {
          const batch =
            this.prefetchedBatch(startFrame) ??
            (await this.decodeStartBatch(generation, startFrame));

          if (generation === this.generation) {
            if (batch.length === 0 && this.hasTracks) throw new Error("Audio preparation failed.");
            if (batch.length > 0) this.preparedBatch = { batch, generation };
            return;
          }
        }
      } finally {
        if (generation === this.generation) {
          this.batchInFlight = false;
          if (this.preparation === preparation) this.preparation = null;
          this.refreshStatuses();
        }
      }
      if (this.preparation !== preparation || !this.hasTracks) {
        throw new Error("Audio preparation was interrupted.");
      }
    }
  }

  /**
   * Decodes the chunk starting at `seconds` without touching current playback, so a later
   * `prepareAt` there (a loop restart) needs no decode. Best effort: failures leave no chunk.
   */
  async prefetchAt(seconds: number): Promise<void> {
    if (!this.hasTracks || this.durationFrames <= 0) return;
    this.prefetchSeconds = seconds;
    const startFrame = this.secondsToFrame(seconds);
    if (this.prefetchedRanges(startFrame) || this.prefetchRequest?.startFrame === startFrame)
      return;

    this.discardPrefetch();
    const endFrame = this.nextChunkEndFrame(startFrame);
    if (endFrame <= startFrame) return;
    const request = { controller: new AbortController(), startFrame };
    this.prefetchRequest = request;
    try {
      const tracks = [...this.tracks.values()];
      const ranges = await Promise.all(
        tracks.map(async (track) => {
          const render = this.renderOf(track);
          const key = this.prefetchKey(track);
          return {
            buffer: await this.decodeBuffer(
              track,
              render,
              startFrame,
              endFrame,
              request.controller.signal,
            ),
            key,
            render,
            track,
          };
        }),
      );

      if (this.prefetchRequest === request) this.prefetched = { endFrame, ranges, startFrame };
    } catch {
      // A missing prefetch only means the restart decodes on demand.
    } finally {
      if (this.prefetchRequest === request) this.prefetchRequest = null;
    }
  }

  pause(): void {
    this.anchorPositionFrame = this.currentPositionFrame();
    this.isPlaying = false;
    this.playbackRequested = false;
    this.generation += 1;
    this.preparedBatch = null;
    this.batchInFlight = false;
    this.preparation = null;
    this.cancelProcessingChange();
    this.cancelPump();
    this.stopSources();
    this.refreshStatuses();
  }

  seek(seconds: number): void {
    const positionFrame = this.secondsToFrame(seconds);
    const resume = this.playbackRequested || this.isPlaying;
    this.anchorPositionFrame = positionFrame;
    this.nextScheduledFrame = positionFrame;
    this.generation += 1;
    this.batchInFlight = false;
    this.preparation = null;
    this.cancelProcessingChange();
    this.cancelPump();
    this.stopSources();
    for (const track of this.tracks.values()) {
      track.generation = this.generation;
      track.cursorFrame = positionFrame;
      track.scheduledThroughFrame = positionFrame;
    }
    if (resume) {
      const start = this.startAt(positionFrame / SAMPLE_RATE);
      const generation = this.generation;
      void start.catch(() => {
        if (generation !== this.generation) return;
        this.pause();
        this.onPlaybackError();
      });
    } else {
      this.refreshStatuses();
    }
  }

  close(): void {
    this.discardPrefetch();
    this.prefetchSeconds = null;
    this.pause();
    for (const [streamIndex, track] of this.tracks) this.removeTrack(streamIndex, track);
    disconnectStereoAudioMeterNodes(this.audioMeter);
    this.audioMix.disconnect();
    this.outputGain.disconnect();
  }

  private get durationFrames(): number {
    return Math.max(0, Math.round((this.durationMicros * SAMPLE_RATE) / 1_000_000));
  }

  private createTrack(track: WebAudioTrack, selectionKey: string): ScheduledTrack {
    const voice = this.context.createGain();
    const runtime = connectAudioTrackRuntime(this.context, this.audioMix);
    voice.connect(runtime.input);
    const scheduled: ScheduledTrack = {
      offsetFrames: Math.round(((track.syncOffsetMicros ?? 0) * SAMPLE_RATE) / 1_000_000),
      abortController: null,
      audible: null,
      cursorFrame: this.anchorPositionFrame,
      durationFrame:
        track.durationMicros === undefined
          ? this.durationFrames
          : Math.min(
              this.durationFrames,
              Math.round(
                (((track.startTimeMicros ?? 0) + track.durationMicros) * SAMPLE_RATE) / 1_000_000,
              ),
            ),
      failedKey: null,
      generation: this.generation,
      gain: runtime.gain,
      input: runtime.input,
      nodes: new Set(),
      preview: track.preview ?? false,
      retiredVoices: new Set(),
      scheduledThroughFrame: this.anchorPositionFrame,
      selectionKey,
      selection: track.selection,
      startFrame: Math.max(0, Math.round(((track.startTimeMicros ?? 0) * SAMPLE_RATE) / 1_000_000)),
      status: "ready",
      streamIndex: track.streamIndex,
      tag: track.tag,
      voice: { gain: voice, retired: false, sources: new Set() },
    };

    this.tracks.set(track.streamIndex, scheduled);
    this.onTrackStatus(scheduled.streamIndex, scheduled.tag, scheduled.status);
    return scheduled;
  }

  /**
   * The processing to render for a track: the requested one, unless it is a preview that failed
   * to render and earlier audio of the track can stand in for it.
   */
  private renderOf(track: ScheduledTrack): TrackRender {
    if (track.failedKey === track.selectionKey && track.preview && track.audible) {
      return { ...track.audible, offsetFrames: track.offsetFrames, preview: track.preview };
    }
    return {
      offsetFrames: track.offsetFrames,
      key: track.selectionKey,
      preview: track.preview,
      selection: track.selection,
    };
  }

  private pendingStatus(track: ScheduledTrack): TrackRenderStatus {
    if (track.failedKey === track.selectionKey) return "failed";
    if (track.audible?.key === track.selectionKey) return "ready";
    if (this.processingChange !== null) return "updating";
    if (this.preparation !== null || (this.playbackRequested && !this.isPlaying)) {
      return "preparing";
    }
    return "ready";
  }

  private reportStatus(track: ScheduledTrack, status: TrackRenderStatus, force = false): void {
    if (!force && track.status === status) return;
    track.status = status;
    this.onTrackStatus(track.streamIndex, track.tag, status);
  }

  private refreshStatuses(): void {
    for (const track of this.tracks.values()) this.reportStatus(track, this.pendingStatus(track));
  }

  /**
   * Replaces changed processing during playback without a gap. The audible processing keeps
   * rendering and playing while the replacement renders from just ahead of the playhead, however
   * long that takes; then every track switches at one sample position with a short crossfade. The
   * timeline mapping never changes, so audio stays aligned with the video. A newer change replaces
   * a running one, so playback only ever switches to the latest processing. A replacement that
   * cannot be rendered is only reported: the audible processing keeps playing.
   */
  private changeProcessing(): void {
    this.cancelProcessingChange();
    const change: ProcessingChange = { controllers: new Set() };
    this.processingChange = change;
    this.preparedBatch = null;
    this.refreshStatuses();
    void this.runProcessingChange(change);
  }

  private async runProcessingChange(change: ProcessingChange): Promise<void> {
    let switched = false;
    try {
      switched = await this.renderProcessingChange(change);
    } catch {
      // The failure is recorded on its track and reported through its render status.
    }
    if (this.processingChange !== change) return;
    this.processingChange = null;
    this.refreshStatuses();
    if (switched && this.prefetchSeconds !== null) void this.prefetchAt(this.prefetchSeconds);
  }

  /** Renders the replacement ahead of the playhead and switches to it; false if nothing changed. */
  private async renderProcessingChange(change: ProcessingChange): Promise<boolean> {
    for (;;) {
      // The replacement may be the audible processing again, e.g. an undone edit or a fallback.
      if (
        [...this.tracks.values()].every((track) => track.audible?.key === this.renderOf(track).key)
      ) {
        return false;
      }
      const startFrame = this.frameAtContextTime(
        this.context.currentTime + PROCESSING_CHANGE_LEAD_SECONDS,
      );

      // The scheduled audio already reaches the end of the range; nothing is left to replace.
      if (startFrame >= this.durationFrames) return false;
      const endFrame = this.nextChunkEndFrame(startFrame);
      const batch = await this.decodeReplacement(change, startFrame, endFrame);
      if (this.processingChange !== change) return false;
      const switchFrame = Math.max(
        startFrame,
        this.frameAtContextTime(this.context.currentTime + MIN_SCHEDULE_LEAD_SECONDS),
      );

      if (switchFrame >= endFrame && endFrame >= this.durationFrames) return false;
      if (
        switchFrame <= endFrame - PROCESSING_CHANGE_MIN_FRAMES ||
        endFrame >= this.durationFrames
      ) {
        this.switchProcessing(batch, switchFrame);
        return true;
      }
      // Rendering took longer than the audio it produced; render again from the playhead.
    }
  }

  /** Renders the replacement processing of every track without stopping the audible processing. */
  private decodeReplacement(
    change: ProcessingChange,
    startFrame: number,
    endFrame: number,
  ): Promise<DecodedSampleRange[]> {
    return Promise.all(
      [...this.tracks.values()].map(async (track) => {
        const controller = new AbortController();
        change.controllers.add(controller);
        const render = this.renderOf(track);
        try {
          const buffer = await this.decodeBuffer(
            track,
            render,
            startFrame,
            endFrame,
            controller.signal,
          );

          if (track.failedKey === render.key) track.failedKey = null;
          return { buffer, endFrame, render, startFrame, track };
        } catch (error) {
          if (controller.signal.aborted || this.processingChange !== change) throw error;
          throw this.renderFailure(track, render, error);
        } finally {
          change.controllers.delete(controller);
        }
      }),
    );
  }

  /**
   * Records that the requested processing of a track failed to render. A preview the track's
   * earlier audio can replace becomes a `PreviewRenderFailure`; any other failure is returned
   * unchanged.
   */
  private renderFailure(track: ScheduledTrack, render: TrackRender, error: unknown): unknown {
    if (render.key !== track.selectionKey) return error;
    track.failedKey = render.key;
    return render.preview && track.audible && track.audible.key !== render.key
      ? new PreviewRenderFailure()
      : error;
  }

  /**
   * How a render is requested. During playback, only the audible processing is requested as
   * audible; any other processing, such as a replacement or a prefetched restart, is a
   * replacement, so it never takes the native renderer away from the audio that is playing.
   */
  private roleOf(track: ScheduledTrack, render: TrackRender): DecodeRole {
    return {
      preview: render.preview,
      replacement: this.isPlaying && track.audible !== null && track.audible.key !== render.key,
    };
  }

  /**
   * Starts the replacement at `switchFrame`, fades the audible processing out there, and lets the
   * pump continue with the replacement after its first chunk.
   */
  private switchProcessing(batch: DecodedSampleRange[], switchFrame: number): void {
    this.generation += 1;
    const generation = this.generation;
    this.cancelPump();
    this.batchInFlight = false;
    const switchTime = this.contextTimeAtFrame(switchFrame);
    const { endFrame } = batch[0]!;
    for (const range of batch) {
      const { track } = range;
      // A chunk the pump is decoding for the previous processing is no longer needed.
      track.abortController?.abort();
      track.abortController = null;
      track.generation = generation;
      track.cursorFrame = endFrame;
      const previous = track.voice;
      previous.retired = true;
      // A voice may still be fading in from a switch moments ago; fade out from where it is.
      if (typeof previous.gain.gain.cancelAndHoldAtTime === "function") {
        previous.gain.gain.cancelAndHoldAtTime(switchTime);
      } else {
        previous.gain.gain.cancelScheduledValues(switchTime);
        previous.gain.gain.setValueAtTime(1, switchTime);
      }
      previous.gain.gain.linearRampToValueAtTime(0, switchTime + PROCESSING_CROSSFADE_SECONDS);
      for (const source of previous.sources) {
        try {
          source.stop(switchTime + PROCESSING_CROSSFADE_SECONDS);
        } catch {
          // A source may already have ended.
        }
      }
      if (previous.sources.size === 0) previous.gain.disconnect();
      else track.retiredVoices.add(previous);

      const voice = this.context.createGain();
      voice.connect(track.input);
      voice.gain.setValueAtTime(0, switchTime);
      voice.gain.linearRampToValueAtTime(1, switchTime + PROCESSING_CROSSFADE_SECONDS);
      track.voice = { gain: voice, retired: false, sources: new Set() };
      track.scheduledThroughFrame = switchFrame;
      this.schedule(range, switchTime, switchFrame);
    }
    this.nextScheduledFrame = endFrame;
    this.nextScheduledContextTime =
      switchTime + this.framesToContextSeconds(endFrame - switchFrame);
    this.requestPump();
  }

  /** The source frame the running playback reaches at a context time. */
  private frameAtContextTime(contextTime: number): number {
    return (
      this.anchorPositionFrame +
      Math.ceil((contextTime - this.anchorContextTime) * SAMPLE_RATE * this.playbackRate)
    );
  }

  private contextTimeAtFrame(frame: number): number {
    return this.anchorContextTime + this.framesToContextSeconds(frame - this.anchorPositionFrame);
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
    // A running playback continues its audible processing; only a start or a switch changes it.
    const render = this.isPlaying && track.audible ? track.audible : this.renderOf(track);
    try {
      const buffer = await this.decodeBuffer(
        track,
        render,
        startFrame,
        endFrame,
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
      track.cursorFrame = endFrame;
      if (track.failedKey === render.key) track.failedKey = null;
      return { buffer, endFrame, render, startFrame, track };
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation) return null;
      throw this.renderFailure(track, render, error);
    } finally {
      if (track.abortController === controller) track.abortController = null;
    }
  }

  /** Decodes a start chunk, replacing a failed preview with the track's earlier audio once. */
  private async decodeStartBatch(
    generation: number,
    startFrame: number,
  ): Promise<DecodedSampleRange[]> {
    const endFrame = this.nextChunkEndFrame(startFrame);
    try {
      return await this.decodeBatch(generation, startFrame, endFrame);
    } catch (error) {
      if (!(error instanceof PreviewRenderFailure) || generation !== this.generation) throw error;
      for (const track of this.tracks.values()) {
        track.abortController?.abort();
        track.abortController = null;
        track.cursorFrame = startFrame;
      }
      this.refreshStatuses();
      return this.decodeBatch(generation, startFrame, endFrame);
    }
  }

  private async decodeBuffer(
    track: ScheduledTrack,
    render: TrackRender,
    startFrame: number,
    endFrame: number,
    signal: AbortSignal,
  ): Promise<AudioBuffer> {
    const decodeStartFrame = Math.max(startFrame - render.offsetFrames, track.startFrame);
    const decodeEndFrame = Math.min(endFrame - render.offsetFrames, track.durationFrame);
    const decodeFrameCount = Math.max(0, decodeEndFrame - decodeStartFrame);
    const chunk =
      decodeFrameCount > 0
        ? await this.decodeChunk(
            render.selection,
            this.frameToMicros(decodeStartFrame),
            this.frameToMicros(decodeEndFrame) - this.frameToMicros(decodeStartFrame),
            signal,
            this.roleOf(track, render),
          )
        : { channels: CHANNELS, sampleRate: SAMPLE_RATE, samples: new Float32Array() };

    const decodedFrameCount = chunk.samples.length / chunk.channels;
    if (
      chunk.channels !== CHANNELS ||
      chunk.sampleRate !== SAMPLE_RATE ||
      !Number.isInteger(decodedFrameCount) ||
      decodedFrameCount > decodeFrameCount ||
      (decodedFrameCount !== decodeFrameCount && decodeEndFrame < track.durationFrame)
    ) {
      throw new Error("Decoded audio did not match its requested sample range.");
    }

    const buffer = this.context.createBuffer(CHANNELS, endFrame - startFrame, SAMPLE_RATE);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const destinationStartFrame = decodeStartFrame + render.offsetFrames - startFrame;
    for (let frame = 0; frame < decodedFrameCount; frame += 1) {
      left[destinationStartFrame + frame] = chunk.samples[frame * chunk.channels]!;
      right[destinationStartFrame + frame] = chunk.samples[frame * chunk.channels + 1]!;
    }
    return buffer;
  }

  /** Everything a decoded chunk depends on; a change makes a prefetched chunk stale. */
  private prefetchKey(track: ScheduledTrack): string {
    return `${this.renderOf(track).key}|${track.offsetFrames}|${track.startFrame}|${track.durationFrame}`;
  }

  private prefetchedRanges(startFrame: number): PrefetchedAudioChunk["ranges"] | null {
    const prefetched = this.prefetched;
    if (
      !prefetched ||
      prefetched.startFrame !== startFrame ||
      prefetched.endFrame !== this.nextChunkEndFrame(startFrame) ||
      prefetched.ranges.length !== this.tracks.size ||
      prefetched.ranges.some(
        ({ key, track }) =>
          this.tracks.get(track.streamIndex) !== track || this.prefetchKey(track) !== key,
      )
    ) {
      return null;
    }
    return prefetched.ranges;
  }

  /** Reuses a prefetched chunk as the prepared batch; AudioBuffers can back many sources. */
  private prefetchedBatch(startFrame: number): DecodedSampleRange[] | null {
    const ranges = this.prefetchedRanges(startFrame);
    if (!ranges) return null;
    const endFrame = this.nextChunkEndFrame(startFrame);
    for (const { track } of ranges) track.cursorFrame = endFrame;
    return ranges.map(({ buffer, render, track }) => ({
      buffer,
      endFrame,
      render,
      startFrame,
      track,
    }));
  }

  private discardPrefetch(): void {
    this.prefetchRequest?.controller.abort();
    this.prefetchRequest = null;
    this.prefetched = null;
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
      // An active transport cannot move a chunk independently of the video clock.
      // Report the underrun to Playback so both participants stop together.
      if (this.isPlaying) throw new Error("Audio decoding missed its scheduling boundary.");
      sharedStart = this.context.currentTime + MIN_SCHEDULE_LEAD_SECONDS;
      this.anchorContextTime = sharedStart;
      this.anchorPositionFrame = startFrame;
    }

    for (const range of batch) this.schedule(range, sharedStart);
    this.nextScheduledFrame = endFrame;
    this.nextScheduledContextTime =
      sharedStart + this.framesToContextSeconds(endFrame - startFrame);
  }

  private schedulePreparedBatch(
    batch: DecodedSampleRange[],
    startFrame: number,
    contextStart: number,
  ): void {
    if (batch.length !== this.tracks.size || batch.length === 0) {
      throw new Error("Prepared audio batch does not include every active track.");
    }
    const firstRange = batch[0]!;
    if (startFrame < firstRange.startFrame || startFrame >= firstRange.endFrame) {
      throw new Error("Prepared audio does not cover the requested playback position.");
    }
    for (const range of batch) {
      if (
        range.startFrame !== firstRange.startFrame ||
        range.endFrame !== firstRange.endFrame ||
        range.track.scheduledThroughFrame !== startFrame
      ) {
        throw new Error("Prepared audio tracks cannot schedule different sample ranges.");
      }
    }

    let sharedStart = contextStart;
    const earliestSafeStart = this.context.currentTime + MIN_SCHEDULE_LEAD_SECONDS;
    if (sharedStart < earliestSafeStart) {
      sharedStart = earliestSafeStart;
      this.anchorContextTime = sharedStart;
      this.anchorPositionFrame = startFrame;
    }

    for (const range of batch) this.schedule(range, sharedStart, startFrame);
    this.nextScheduledFrame = firstRange.endFrame;
    this.nextScheduledContextTime =
      sharedStart + this.framesToContextSeconds(firstRange.endFrame - startFrame);
  }

  private schedule(
    range: DecodedSampleRange,
    contextStart: number,
    scheduledStartFrame = range.startFrame,
  ): void {
    const { buffer, endFrame, track } = range;
    if (scheduledStartFrame < range.startFrame || scheduledStartFrame >= endFrame) {
      throw new Error("Audio playback cannot start outside its decoded sample range.");
    }
    if (scheduledStartFrame !== track.scheduledThroughFrame) {
      throw new Error("Audio buffer sample ranges contain a gap or overlap.");
    }
    const source = this.context.createBufferSource();
    const generation = this.generation;
    const voice = track.voice;
    source.buffer = buffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(voice.gain);
    source.onended = () => {
      source.disconnect();
      track.nodes.delete(source);
      voice.sources.delete(source);
      if (voice.retired && voice.sources.size === 0) {
        voice.gain.disconnect();
        track.retiredVoices.delete(voice);
      }
      if (generation !== this.generation) return;
      if (this.currentPositionFrame() >= this.durationFrames && this.isPlaying) {
        this.pause();
        this.onEnded();
      } else if (
        this.isPlaying &&
        endFrame === this.nextScheduledFrame &&
        endFrame < this.durationFrames
      ) {
        this.pause();
        this.onPlaybackError();
      }
    };
    source.start(contextStart, (scheduledStartFrame - range.startFrame) / SAMPLE_RATE);
    track.nodes.add(source);
    voice.sources.add(source);
    track.scheduledThroughFrame = endFrame;
    track.audible = range.render;
  }

  private requestPump(): void {
    if (!this.isPlaying || this.pumpFrame !== null || this.batchInFlight) return;
    void this.pumpNextBatch(this.generation);
  }

  private async pumpNextBatch(generation: number): Promise<void> {
    if (!this.isPlaying || generation !== this.generation || this.batchInFlight) return;
    if (this.currentPositionFrame() >= this.durationFrames) {
      this.pause();
      this.onEnded();
      return;
    }
    // Faster playback consumes decoded audio sooner; keep the same real-time lead.
    const horizonFrame = Math.min(
      this.durationFrames,
      this.currentPositionFrame() + MAX_BUFFER_AHEAD_FRAMES * Math.max(1, this.playbackRate),
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
      // The audible processing itself failed to render, so nothing can keep playing.
      if (generation !== this.generation) return;
      this.pause();
      this.onPlaybackError();
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
    for (const track of this.tracks.values()) this.stopTrackSources(track);
  }

  /** Stops a track's sources, ends any processing crossfade, and leaves one silent voice. */
  private stopTrackSources(track: ScheduledTrack): void {
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
    for (const voice of track.retiredVoices) voice.gain.disconnect();
    track.retiredVoices.clear();
    track.voice.sources.clear();
    track.voice.gain.gain.cancelScheduledValues(0);
    track.voice.gain.gain.value = 1;
  }

  private invalidateTrack(track: ScheduledTrack, positionFrame: number): void {
    this.stopTrackSources(track);
    track.generation = this.generation;
    track.cursorFrame = positionFrame;
    track.scheduledThroughFrame = positionFrame;
  }

  private removeTrack(streamIndex: number, track: ScheduledTrack): void {
    this.invalidateTrack(track, this.currentPositionFrame());
    track.voice.gain.disconnect();
    disconnectAudioTrackRuntime(track);
    this.tracks.delete(streamIndex);
  }

  private cancelProcessingChange(): void {
    for (const controller of this.processingChange?.controllers ?? []) controller.abort();
    this.processingChange = null;
  }

  private currentPositionFrame(): number {
    if (!this.isPlaying) return Math.min(this.durationFrames, this.anchorPositionFrame);

    const elapsedFrames = Math.floor(
      Math.max(0, this.outputContextTime() - this.anchorContextTime) *
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

  private framesToContextSeconds(frames: number): number {
    return frames / (SAMPLE_RATE * this.playbackRate);
  }

  private secondsToFrame(seconds: number): number {
    return Math.min(this.durationFrames, Math.max(0, Math.round(seconds * SAMPLE_RATE)));
  }

  private outputContextTime(): number {
    const timestamp = this.context.getOutputTimestamp?.();
    if (
      timestamp?.contextTime !== undefined &&
      timestamp.contextTime > 0 &&
      timestamp.performanceTime !== undefined &&
      timestamp.performanceTime > 0
    ) {
      return Math.min(
        this.context.currentTime,
        timestamp.contextTime + Math.max(0, performance.now() - timestamp.performanceTime) / 1_000,
      );
    }
    return Math.max(
      0,
      this.context.currentTime -
        (this.context.baseLatency || 0) -
        (this.context.outputLatency || 0),
    );
  }

  private frameToMicros(frame: number): number {
    return Math.min(this.durationMicros, Math.round((frame * 1_000_000) / SAMPLE_RATE));
  }
}

export { WebAudioEngine };
export type { DecodeChunk, PcmChunk, TrackRenderStatus, TrackRenderStatusObserver, WebAudioTrack };
