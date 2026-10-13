import { afterEach, describe, expect, it, vi } from "vitest";

import type { AudioTrackSelection } from "@/domain/audio-processing";

import { WebAudioEngine } from "../web-audio-engine";

function parameter(value = 1) {
  return {
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    value,
  };
}

function node() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: parameter(),
  };
}

function createContext() {
  const sources: Array<
    ReturnType<typeof node> & { buffer: AudioBuffer | null; start: ReturnType<typeof vi.fn> }
  > = [];

  const gains: ReturnType<typeof node>[] = [];
  let currentTime = 5;
  const context = {
    destination: node(),
    close: vi.fn(async () => undefined),
    createAnalyser: vi.fn(() => ({ ...node(), fftSize: 2048, getFloatTimeDomainData: vi.fn() })),
    createBuffer: vi.fn((_channels: number, frames: number, sampleRate: number) => ({
      duration: frames / sampleRate,
      getChannelData: () => new Float32Array(frames),
    })),
    createBufferSource: vi.fn(() => {
      const source = {
        ...node(),
        buffer: null as AudioBuffer | null,
        onended: null as (() => void) | null,
        playbackRate: parameter(),
        start: vi.fn(),
        stop: vi.fn(),
      };

      sources.push(source);
      return source;
    }),
    createChannelSplitter: vi.fn(() => ({ ...node(), channelCount: 2 })),
    createGain: vi.fn(() => {
      const gain = node();
      gains.push(gain);
      return gain;
    }),
    createWaveShaper: vi.fn(() => ({ ...node(), curve: null, oversample: "none" })),
    resume: vi.fn(async () => undefined),
  } as unknown as AudioContext;

  Object.defineProperty(context, "currentTime", { get: () => currentTime });

  return {
    context,
    gains,
    sources,
    setCurrentTime: (nextTime: number) => {
      currentTime = nextTime;
    },
  };
}

function selection(streamIndex: number): AudioTrackSelection {
  return { processing: { gainDb: 0 }, streamIndex };
}

function chunk(durationMicros = 2_000_000) {
  const frameCount = Math.round((durationMicros * 48_000) / 1_000_000);
  return {
    channels: 2,
    sampleRate: 48_000,
    samples: Array.from({ length: frameCount * 2 }, () => 100),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("WebAudioEngine", () => {
  it("schedules every active track against the same AudioContext time", async () => {
    const { context, sources } = createContext();
    const decode = vi.fn(
      async (_selection: AudioTrackSelection, _startMicros: number, durationMicros: number) =>
        chunk(durationMicros),
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(4_000_000);
    const tracks = [1, 2, 3, 4].map((streamIndex) => ({
      gainDb: streamIndex,
      limiterProcessing: {
        ceilingDb: -1,
        stage: "finalProtection" as const,
        type: "limiter" as const,
      },
      selection: {
        processing: {
          effects: [
            { cutoffHz: 80 + streamIndex, stage: "cleanup" as const, type: "highPass" as const },
            {
              preset: "medium" as const,
              stage: "cleanup" as const,
              type: "noiseReduction" as const,
            },
          ],
          gainDb: 0,
        },
        streamIndex,
      },
      streamIndex,
    }));

    engine.setTracks(tracks);

    await engine.startAt(1.25);

    expect(decode).toHaveBeenCalledTimes(8);
    expect(context.createWaveShaper).toHaveBeenCalledTimes(4);
    expect(sources.length).toBeGreaterThanOrEqual(4);
    expect(sources.map((source) => source.start.mock.calls[0]?.[0])).toEqual([
      sources[0]?.start.mock.calls[0]?.[0],
      sources[0]?.start.mock.calls[0]?.[0],
      sources[0]?.start.mock.calls[0]?.[0],
      sources[0]?.start.mock.calls[0]?.[0],
    ]);
    expect(engine.currentTimeSeconds).toBeCloseTo(1.25);

    engine.close();
  });

  it("discards an in-flight chunk when a seek invalidates its generation", async () => {
    const { context, sources } = createContext();
    let resolveChunk: ((value: ReturnType<typeof chunk>) => void) | undefined;
    const decode = vi.fn(
      (_selection: AudioTrackSelection, _startMicros: number, durationMicros: number) =>
        new Promise<ReturnType<typeof chunk>>((resolve) => {
          resolveChunk = () => resolve(chunk(durationMicros));
        }),
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(4_000_000);
    engine.setTracks([{ gainDb: 0, selection: selection(2), streamIndex: 2 }]);

    const starting = engine.startAt(0);
    await Promise.resolve();
    engine.seek(3);
    resolveChunk?.(chunk());
    await starting;

    expect(sources).toHaveLength(0);
    engine.close();
  });

  it("holds the clock during delayed startup and keeps a paused position stable on resume", async () => {
    const { context, setCurrentTime } = createContext();
    let resolveChunk: (() => void) | undefined;
    const decode = vi.fn(
      (_selection: AudioTrackSelection, _startMicros: number, durationMicros: number) =>
        new Promise<ReturnType<typeof chunk>>((resolve) => {
          resolveChunk = () => resolve(chunk(durationMicros));
        }),
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(8_000_000);
    engine.setTracks([{ gainDb: 0, selection: selection(1), streamIndex: 1 }]);

    const starting = engine.startAt(1);
    await Promise.resolve();
    setCurrentTime(9);
    expect(engine.currentTimeSeconds).toBe(1);

    resolveChunk?.();
    await starting;
    setCurrentTime(10.15);
    expect(engine.currentTimeSeconds).toBeCloseTo(2);

    engine.pause();
    setCurrentTime(20);
    expect(engine.currentTimeSeconds).toBeCloseTo(2);

    const resuming = engine.startAt(engine.currentTimeSeconds);
    await Promise.resolve();
    resolveChunk?.();
    await resuming;
    setCurrentTime(21.15);
    expect(engine.currentTimeSeconds).toBeCloseTo(3);

    engine.close();
  });

  it("keeps the requested seek position stable while replacement audio buffers", async () => {
    const { context, setCurrentTime, sources } = createContext();
    let resolveSeekChunk: (() => void) | undefined;
    const decode = vi.fn(
      (_selection: AudioTrackSelection, startMicros: number, durationMicros: number) => {
        if (startMicros >= 3_000_000) {
          return new Promise<ReturnType<typeof chunk>>((resolve) => {
            resolveSeekChunk = () => resolve(chunk(durationMicros));
          });
        }
        return Promise.resolve(chunk(durationMicros));
      },
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(8_000_000);
    engine.setTracks([{ gainDb: 0, selection: selection(1), streamIndex: 1 }]);
    await engine.startAt(0);
    const sourceCountBeforeSeek = sources.length;

    engine.seek(4);
    await vi.waitFor(() => expect(resolveSeekChunk).toBeDefined());
    setCurrentTime(50);
    expect(engine.currentTimeSeconds).toBe(4);

    resolveSeekChunk?.();
    await vi.waitFor(() => expect(sources.length).toBeGreaterThan(sourceCountBeforeSeek));
    setCurrentTime(51.15);
    expect(engine.currentTimeSeconds).toBeCloseTo(5);

    engine.close();
  });

  it("keeps retained tracks schedulable when tracks are removed or added during playback", async () => {
    const { context } = createContext();
    const decodedStreamIndexes: number[] = [];
    const decode = vi.fn(
      async (track: AudioTrackSelection, _startMicros: number, durationMicros: number) => {
        decodedStreamIndexes.push(track.streamIndex);
        return chunk(durationMicros);
      },
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(8_000_000);
    engine.setTracks(
      [1, 2].map((streamIndex) => ({
        gainDb: 0,
        selection: selection(streamIndex),
        streamIndex,
      })),
    );
    await engine.startAt(1);

    engine.setTracks([
      { gainDb: 0, selection: selection(2), streamIndex: 2 },
      { gainDb: 0, selection: selection(3), streamIndex: 3 },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(decodedStreamIndexes).toContain(3);
    expect(engine.hasTracks).toBe(true);
    engine.close();
  });

  it("removes track nodes and keeps output gain on the shared master graph", async () => {
    const { context, gains } = createContext();
    const engine = new WebAudioEngine(
      context,
      async (_selection, _startMicros, durationMicros) => chunk(durationMicros),
      vi.fn(),
    );

    engine.setDuration(2_000_000);
    engine.setTracks([{ gainDb: -6, selection: selection(4), streamIndex: 4 }]);
    const trackGain = gains.at(-1)!;

    engine.setOutputGain(0.5);
    engine.setTracks([]);

    expect(trackGain.disconnect).toHaveBeenCalled();
    expect(engine.hasTracks).toBe(false);
    engine.close();
  });

  it("keeps multitrack sample ranges aligned through delayed decoding and underruns", async () => {
    vi.useFakeTimers();
    const { context, setCurrentTime, sources } = createContext();
    let resolveDelayedChunk: (() => void) | undefined;
    const decodedRanges: Array<{ startMicros: number; streamIndex: number }> = [];
    const decode = vi.fn(
      (track: AudioTrackSelection, startMicros: number, durationMicros: number) => {
        decodedRanges.push({ startMicros, streamIndex: track.streamIndex });
        if (startMicros === 2_000_000 && track.streamIndex === 2) {
          return new Promise<ReturnType<typeof chunk>>((resolve) => {
            resolveDelayedChunk = () => resolve(chunk(durationMicros));
          });
        }
        return Promise.resolve(chunk(durationMicros));
      },
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(8_000_000);
    engine.setTracks(
      [1, 2].map((streamIndex) => ({
        gainDb: 0,
        selection: selection(streamIndex),
        streamIndex,
      })),
    );

    await engine.startAt(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(decodedRanges).toEqual([
      { startMicros: 0, streamIndex: 1 },
      { startMicros: 0, streamIndex: 2 },
      { startMicros: 2_000_000, streamIndex: 1 },
      { startMicros: 2_000_000, streamIndex: 2 },
    ]);

    setCurrentTime(7.3);
    expect(engine.currentTimeSeconds).toBe(2);
    resolveDelayedChunk?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    const delayedRangeSources = sources.slice(2, 4);
    expect(delayedRangeSources.map((source) => source.start.mock.calls[0]?.[0])).toEqual([
      7.305, 7.305,
    ]);
    expect(engine.currentTimeSeconds).toBe(2);

    setCurrentTime(9.305);
    expect(engine.currentTimeSeconds).toBeCloseTo(4, 4);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(0);

    expect(decodedRanges.slice(4)).toEqual([
      { startMicros: 4_000_000, streamIndex: 1 },
      { startMicros: 4_000_000, streamIndex: 2 },
      { startMicros: 6_000_000, streamIndex: 1 },
      { startMicros: 6_000_000, streamIndex: 2 },
    ]);
    const startsByRange = [sources.slice(4, 6), sources.slice(6, 8)].map((range) =>
      range.map((source) => source.start.mock.calls[0]?.[0]),
    );

    expect(startsByRange[0]?.[0]).toBe(startsByRange[0]?.[1]);
    expect(startsByRange[1]?.[0]).toBe(startsByRange[1]?.[1]);
    expect(startsByRange[1]?.[0]).toBe((startsByRange[0]?.[0] ?? 0) + 2);
    engine.close();
    vi.useRealTimers();
  });
});
