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
    ReturnType<typeof node> & {
      buffer: AudioBuffer | null;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }
  > = [];

  const gains: ReturnType<typeof node>[] = [];
  const buffers: Array<{ channels: Float32Array[]; duration: number }> = [];
  const filters: Array<{
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    frequency: ReturnType<typeof parameter>;
    Q: ReturnType<typeof parameter>;
    type: BiquadFilterType;
  }> = [];

  let currentTime = 5;
  const context = {
    destination: node(),
    close: vi.fn(async () => undefined),
    createAnalyser: vi.fn(() => ({ ...node(), fftSize: 2048, getFloatTimeDomainData: vi.fn() })),
    createBiquadFilter: vi.fn(() => {
      const filter = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequency: parameter(0),
        Q: parameter(Math.SQRT1_2),
        type: "highpass" as BiquadFilterType,
      };

      filters.push(filter);
      return filter;
    }),
    createBuffer: vi.fn((channelCount: number, frames: number, sampleRate: number) => {
      const audioBuffer = {
        channels: Array.from({ length: channelCount }, () => new Float32Array(frames)),
        duration: frames / sampleRate,
        getChannelData: (channel: number) => audioBuffer.channels[channel]!,
      };

      buffers.push(audioBuffer);
      return audioBuffer;
    }),
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
    resume: vi.fn(async () => undefined),
  } as unknown as AudioContext;

  Object.defineProperty(context, "currentTime", { get: () => currentTime });

  return {
    buffers,
    context,
    gains,
    filters,
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
  it("keeps a fractional-sample resume's final decode within the native media range", async () => {
    const { context, sources } = createContext();
    const onError = vi.fn();
    const decode = vi.fn(async (_track: AudioTrackSelection, start: number, duration: number) => {
      if (start + duration > 4_000_000) throw new Error("Native export range is invalid.");
      return chunk(duration);
    });

    const engine = new WebAudioEngine(context, decode, vi.fn(), onError);
    engine.setDuration(4_000_000);
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
    ]);

    await engine.startAt(1.463062);
    await vi.waitFor(() => expect(sources).toHaveLength(2));

    expect(decode).toHaveBeenLastCalledWith(
      selection(1),
      3_463_063,
      536_937,
      expect.any(AbortSignal),
    );
    expect(onError).not.toHaveBeenCalled();
    const firstStart = sources[0]!.start.mock.calls[0]![0] as number;
    expect(sources[1]!.start.mock.calls[0]![0]).toBe(firstStart + sources[0]!.buffer!.duration);
    engine.close();
  });

  it("pads leading gaps and a short valid stream end into the shared sample range", async () => {
    const { buffers, context, sources } = createContext();
    const decode = vi.fn(
      async (track: AudioTrackSelection, _startMicros: number, durationMicros: number) =>
        track.streamIndex === 1 ? chunk(750_000) : chunk(durationMicros),
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(4_000_000);
    engine.setTracks([
      {
        durationMicros: 1_000_000,
        gainDb: 0,
        liveHighPassEffects: [],
        selection: selection(1),
        startTimeMicros: 1_000_000,
        streamIndex: 1,
      },
      {
        durationMicros: 2_000_000,
        gainDb: 0,
        liveHighPassEffects: [],
        selection: selection(2),
        startTimeMicros: 0,
        streamIndex: 2,
      },
    ]);

    await engine.startAt(0);

    expect(decode).toHaveBeenNthCalledWith(
      1,
      selection(1),
      1_000_000,
      1_000_000,
      expect.any(AbortSignal),
    );
    expect(decode).toHaveBeenNthCalledWith(2, selection(2), 0, 2_000_000, expect.any(AbortSignal));
    expect(sources[0]?.start).toHaveBeenCalledWith(expect.any(Number), 0);
    expect(sources[1]?.start).toHaveBeenCalledWith(expect.any(Number), 0);
    const delayedTrack = buffers[0]!;
    expect(delayedTrack.channels[0]![0]).toBe(0);
    expect(delayedTrack.channels[0]![48_000]).toBeCloseTo(100 / 32768);
    expect(delayedTrack.channels[0]![1_800 * 48]).toBe(0);

    engine.close();
  });

  it("keeps short decodes inside a declared stream range as explicit errors", async () => {
    const { context } = createContext();
    const engine = new WebAudioEngine(context, async () => chunk(1_000_000), vi.fn());
    engine.setDuration(4_000_000);
    engine.setTracks([
      {
        durationMicros: 4_000_000,
        gainDb: 0,
        liveHighPassEffects: [],
        selection: selection(1),
        startTimeMicros: 0,
        streamIndex: 1,
      },
    ]);

    await expect(engine.startAt(0)).rejects.toThrow(
      "Decoded audio did not match its requested sample range.",
    );
    engine.close();
  });

  it("reports a subsequent decode failure after successful audio startup", async () => {
    const { context, sources } = createContext();
    const onPlaybackError = vi.fn();
    let rejectNextBatch: ((error: Error) => void) | undefined;
    const decode = vi.fn(
      async (_selection: AudioTrackSelection, startMicros: number, durationMicros: number) => {
        if (startMicros > 0) {
          return new Promise<ReturnType<typeof chunk>>((_resolve, reject) => {
            rejectNextBatch = reject;
          });
        }
        return chunk(durationMicros);
      },
    );

    const engine = new WebAudioEngine(context, decode, vi.fn(), onPlaybackError);
    engine.setDuration(8_000_000);
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
    ]);

    await engine.startAt(0);

    expect(sources).toHaveLength(1);
    await vi.waitFor(() => expect(rejectNextBatch).toBeDefined());
    expect(onPlaybackError).not.toHaveBeenCalled();
    rejectNextBatch?.(new Error("Subsequent PCM batch failed."));
    await vi.waitFor(() => expect(onPlaybackError).toHaveBeenCalledOnce());
    expect(sources[0]?.stop).toHaveBeenCalledOnce();
    expect(engine.currentTimeSeconds).toBe(0);
    engine.close();
  });

  it("ignores a subsequent batch failure after a seek supersedes its generation", async () => {
    const { context } = createContext();
    const onPlaybackError = vi.fn();
    let rejectSupersededBatch: ((error: Error) => void) | undefined;
    const decode = vi.fn(
      (_selection: AudioTrackSelection, startMicros: number, durationMicros: number) => {
        if (startMicros === 2_000_000) {
          return new Promise<ReturnType<typeof chunk>>((_resolve, reject) => {
            rejectSupersededBatch = reject;
          });
        }
        return Promise.resolve(chunk(durationMicros));
      },
    );

    const engine = new WebAudioEngine(context, decode, vi.fn(), onPlaybackError);
    engine.setDuration(8_000_000);
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
    ]);

    await engine.startAt(0);
    await vi.waitFor(() => expect(rejectSupersededBatch).toBeDefined());
    engine.seek(1);
    await vi.waitFor(() =>
      expect(decode).toHaveBeenCalledWith(
        selection(1),
        1_000_000,
        2_000_000,
        expect.any(AbortSignal),
      ),
    );
    rejectSupersededBatch?.(new Error("Superseded PCM batch failed."));
    await Promise.resolve();
    await Promise.resolve();

    expect(onPlaybackError).not.toHaveBeenCalled();
    expect(engine.currentTimeSeconds).toBeCloseTo(1);
    engine.close();
  });

  it("ignores a pending batch failure after the audio session is disposed", async () => {
    const { context } = createContext();
    const onPlaybackError = vi.fn();
    let rejectPendingBatch: ((error: Error) => void) | undefined;
    const decode = vi.fn(
      (_selection: AudioTrackSelection, startMicros: number, durationMicros: number) => {
        if (startMicros === 2_000_000) {
          return new Promise<ReturnType<typeof chunk>>((_resolve, reject) => {
            rejectPendingBatch = reject;
          });
        }
        return Promise.resolve(chunk(durationMicros));
      },
    );

    const engine = new WebAudioEngine(context, decode, vi.fn(), onPlaybackError);
    engine.setDuration(8_000_000);
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
    ]);

    await engine.startAt(0);
    await vi.waitFor(() => expect(rejectPendingBatch).toBeDefined());
    engine.close();
    rejectPendingBatch?.(new Error("Disposed PCM batch failed."));
    await Promise.resolve();
    await Promise.resolve();

    expect(onPlaybackError).not.toHaveBeenCalled();
  });

  it("schedules every active track against the same AudioContext time", async () => {
    const { context, filters, sources } = createContext();
    const decode = vi.fn(
      async (_selection: AudioTrackSelection, _startMicros: number, durationMicros: number) =>
        chunk(durationMicros),
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(4_000_000);
    const tracks = [1, 2, 3, 4].map((streamIndex) => ({
      gainDb: streamIndex,
      liveHighPassEffects: [
        { cutoffHz: 80 + streamIndex, stage: "cleanup" as const, type: "highPass" as const },
      ],
      selection: {
        processing: {
          effects: [
            {
              preset: "medium" as const,
              stage: "cleanup" as const,
              type: "noiseReduction" as const,
            },
            {
              ceilingDb: -1,
              stage: "finalProtection" as const,
              type: "limiter" as const,
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
    expect(context.createBiquadFilter).toHaveBeenCalledTimes(12);
    expect(
      filters.filter((filter) => filter.frequency.setTargetAtTime.mock.calls.at(-1)?.[0] > 0),
    ).toHaveLength(4);
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

  it("starts a prepared audio range at the synchronized position without decoding again", async () => {
    const { context, sources } = createContext();
    const decode = vi.fn(
      async (_selection: AudioTrackSelection, _startMicros: number, durationMicros: number) =>
        chunk(durationMicros),
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(4_000_000);
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
    ]);

    await engine.prepareAt(1);
    await expect(engine.startPreparedAt(3)).rejects.toThrow(
      "Prepared audio does not cover the requested start position.",
    );
    await engine.startPreparedAt(1.2);

    expect(decode.mock.calls[0]?.[1]).toBe(1_000_000);
    expect(decode.mock.calls.some(([, startMicros]) => startMicros === 1_200_000)).toBe(false);
    expect(sources[0]?.start).toHaveBeenCalledWith(5.15, 0.2);
    expect(engine.currentTimeSeconds).toBeCloseTo(1.2);
    engine.close();
  });

  it.each([
    { durationMicros: 1_000_000, positionMicros: 900_000 },
    { durationMicros: 100_000, positionMicros: 0 },
  ])(
    "schedules the final valid sample for a $durationMicros microsecond media range",
    async ({ durationMicros, positionMicros }) => {
      const { context, sources } = createContext();
      const decode = vi.fn(
        async (_selection: AudioTrackSelection, _startMicros: number, rangeMicros: number) =>
          chunk(rangeMicros),
      );

      const engine = new WebAudioEngine(context, decode, vi.fn());
      engine.setDuration(durationMicros);
      engine.setTracks([
        { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
      ]);

      await engine.prepareAt(positionMicros / 1_000_000);
      const audioStartPosition = await engine.startAlignedWithVideoAt(positionMicros / 1_000_000);

      const lastSampleFrame = Math.round((durationMicros * 48_000) / 1_000_000) - 1;
      const expectedAudioStartPosition = lastSampleFrame / 48_000;
      const preparedStartFrame = Math.round((positionMicros * 48_000) / 1_000_000);
      expect(audioStartPosition).toBe(expectedAudioStartPosition);
      expect(audioStartPosition).toBeLessThan(durationMicros / 1_000_000);
      expect(decode).toHaveBeenCalledWith(
        selection(1),
        positionMicros,
        durationMicros - positionMicros,
        expect.any(AbortSignal),
      );
      expect(sources[0]?.start).toHaveBeenCalledWith(
        5.15,
        (lastSampleFrame - preparedStartFrame) / 48_000,
      );

      engine.close();
    },
  );

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
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(2), streamIndex: 2 },
    ]);

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
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
    ]);

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
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
    ]);
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

  it("continues playback from the last rapid seek while audio replacement is pending", async () => {
    const { context, setCurrentTime, sources } = createContext();
    const pendingDecodes: Array<{
      durationMicros: number;
      resolve: () => void;
      startMicros: number;
    }> = [];

    const decode = vi.fn(
      (_selection: AudioTrackSelection, startMicros: number, durationMicros: number) => {
        if (startMicros === 0) return Promise.resolve(chunk(durationMicros));

        return new Promise<ReturnType<typeof chunk>>((resolve) => {
          pendingDecodes.push({
            durationMicros,
            resolve: () => resolve(chunk(durationMicros)),
            startMicros,
          });
        });
      },
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(8_000_000);
    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(1), streamIndex: 1 },
    ]);
    await engine.startAt(0);

    engine.seek(1.2);
    await vi.waitFor(() =>
      expect(pendingDecodes.some(({ startMicros }) => startMicros === 1_200_000)).toBe(true),
    );
    engine.seek(0.4);
    await vi.waitFor(() =>
      expect(pendingDecodes.some(({ startMicros }) => startMicros === 400_000)).toBe(true),
    );

    const latestDecode = pendingDecodes.find(({ startMicros }) => startMicros === 400_000);
    latestDecode?.resolve();
    await vi.waitFor(() => expect(sources).toHaveLength(2));
    setCurrentTime(5.3);

    expect(sources[1]?.start).toHaveBeenCalledWith(5.15, 0);
    expect(engine.currentTimeSeconds).toBeCloseTo(0.55);

    engine.close();
  });

  it("updates live processing without transport restart and reprimes for baked changes", async () => {
    const { context, filters, sources } = createContext();
    const decode = vi.fn(
      async (_selection: AudioTrackSelection, _startMicros: number, durationMicros: number) =>
        chunk(durationMicros),
    );

    const engine = new WebAudioEngine(context, decode, vi.fn());
    engine.setDuration(8_000_000);

    const selectionWithNoiseReduction = {
      processing: {
        effects: [
          { preset: "light" as const, stage: "cleanup" as const, type: "noiseReduction" as const },
        ],
        gainDb: 0,
      },
      streamIndex: 1,
    };

    engine.setTracks([
      {
        gainDb: 0,
        liveHighPassEffects: [],
        selection: selectionWithNoiseReduction,
        streamIndex: 1,
      },
    ]);
    await engine.startAt(0);
    const firstSource = sources[0]!;

    engine.setTracks([
      {
        gainDb: -3,
        liveHighPassEffects: [{ cutoffHz: 120, stage: "cleanup", type: "highPass" }],
        selection: selectionWithNoiseReduction,
        streamIndex: 1,
      },
    ]);

    expect(firstSource.stop).not.toHaveBeenCalled();
    expect(filters[0]?.frequency.setTargetAtTime).toHaveBeenLastCalledWith(120, 5, 0.015);

    engine.setTracks([
      {
        gainDb: -3,
        liveHighPassEffects: [{ cutoffHz: 120, stage: "cleanup", type: "highPass" }],
        selection: {
          ...selectionWithNoiseReduction,
          processing: {
            effects: [
              {
                preset: "strong" as const,
                stage: "cleanup" as const,
                type: "noiseReduction" as const,
              },
            ],
            gainDb: 0,
          },
        },
        streamIndex: 1,
      },
    ]);

    expect(firstSource.stop).toHaveBeenCalledOnce();
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
        liveHighPassEffects: [],
        selection: selection(streamIndex),
        streamIndex,
      })),
    );
    await engine.startAt(1);

    engine.setTracks([
      { gainDb: 0, liveHighPassEffects: [], selection: selection(2), streamIndex: 2 },
      { gainDb: 0, liveHighPassEffects: [], selection: selection(3), streamIndex: 3 },
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
    engine.setTracks([
      { gainDb: -6, liveHighPassEffects: [], selection: selection(4), streamIndex: 4 },
    ]);
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
        liveHighPassEffects: [],
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
