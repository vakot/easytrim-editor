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
  const sources: Array<ReturnType<typeof node> & { buffer: AudioBuffer | null; start: ReturnType<typeof vi.fn> }> = [];
  const gains: ReturnType<typeof node>[] = [];
  const context = {
    currentTime: 5,
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

  return { context, gains, sources };
}

function selection(streamIndex: number): AudioTrackSelection {
  return { processing: { gainDb: 0 }, streamIndex };
}

function chunk(sampleCount = 8) {
  return { channels: 2, sampleRate: 4, samples: Array.from({ length: sampleCount }, () => 100) };
}

afterEach(() => vi.restoreAllMocks());

describe("WebAudioEngine", () => {
  it("schedules every active track against the same AudioContext time", async () => {
    const { context, sources } = createContext();
    const decode = vi.fn(async () => chunk());
    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(4_000_000);
    const tracks = [1, 2, 3, 4].map((streamIndex) => ({
      gainDb: streamIndex,
      limiterProcessing: { ceilingDb: -1, stage: "finalProtection" as const, type: "limiter" as const },
      selection: {
        processing: {
          effects: [
            { cutoffHz: 80 + streamIndex, stage: "cleanup" as const, type: "highPass" as const },
            { preset: "medium" as const, stage: "cleanup" as const, type: "noiseReduction" as const },
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
      () =>
        new Promise<ReturnType<typeof chunk>>((resolve) => {
          resolveChunk = resolve;
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

  it("keeps retained tracks schedulable when tracks are removed or added during playback", async () => {
    const { context } = createContext();
    const decodedStreamIndexes: number[] = [];
    const decode = vi.fn(async (track: AudioTrackSelection) => {
      decodedStreamIndexes.push(track.streamIndex);
      return chunk();
    });

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(8_000_000);
    engine.setTracks([1, 2].map((streamIndex) => ({
      gainDb: 0,
      selection: selection(streamIndex),
      streamIndex,
    })));
    await engine.startAt(1);

    engine.setTracks([
      { gainDb: 0, selection: selection(2), streamIndex: 2 },
      { gainDb: 0, selection: selection(3), streamIndex: 3 },
    ]);

    expect(decodedStreamIndexes).toContain(3);
    expect(engine.hasTracks).toBe(true);
    engine.close();
  });

  it("removes track nodes and keeps output gain on the shared master graph", async () => {
    const { context, gains } = createContext();
    const engine = new WebAudioEngine(context, async () => chunk(), vi.fn());
    engine.setDuration(2_000_000);
    engine.setTracks([{ gainDb: -6, selection: selection(4), streamIndex: 4 }]);
    const trackGain = gains.at(-1)!;

    engine.setOutputGain(0.5);
    engine.setTracks([]);

    expect(trackGain.disconnect).toHaveBeenCalled();
    expect(engine.hasTracks).toBe(false);
    engine.close();
  });
});
