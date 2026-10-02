import { describe, expect, it, vi } from "vitest";

import {
  connectPlaybackAudioGraph,
  disconnectAudioTrackRuntime,
  updateAudioTrackLimiter,
} from "../audio-playback-graph";

const limiterAt = (ceilingDb: number) =>
  ({ ceilingDb, stage: "finalProtection", type: "limiter" }) as const;

describe("playback audio graph", () => {
  it("meters per-track output before global playback-volume attenuation", () => {
    const destination = {} as AudioNode;
    const splitter = { connect: vi.fn(), disconnect: vi.fn() } as unknown as ChannelSplitterNode;
    const left = { connect: vi.fn(), disconnect: vi.fn(), fftSize: 0 } as unknown as AnalyserNode;
    const right = { connect: vi.fn(), disconnect: vi.fn(), fftSize: 0 } as unknown as AnalyserNode;
    const outputGain = { connect: vi.fn() } as unknown as GainNode;
    const audioMix = { connect: vi.fn() } as unknown as GainNode;
    const context = {
      createAnalyser: vi.fn().mockReturnValueOnce(left).mockReturnValueOnce(right),
      createChannelSplitter: vi.fn().mockReturnValue(splitter),
      createGain: vi.fn().mockReturnValue(outputGain),
      destination,
    } as unknown as AudioContext;

    const output = connectPlaybackAudioGraph(context, audioMix);

    expect(output.meter.source).toBe(audioMix);
    expect(audioMix.connect).toHaveBeenCalledWith(splitter);
    expect(audioMix.connect).toHaveBeenCalledWith(outputGain);
    expect(outputGain.connect).toHaveBeenCalledWith(destination);
  });

  it("disconnects and recreates the runtime Limiter graph symmetrically", () => {
    const firstLimiter = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      oversample: "none",
      curve: null,
    } as unknown as WaveShaperNode;

    const secondLimiter = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      oversample: "none",
      curve: null,
    } as unknown as WaveShaperNode;

    const gain = { connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode;
    const source = { disconnect: vi.fn() } as unknown as MediaElementAudioSourceNode;
    const audioMix = { connect: vi.fn() } as unknown as GainNode;
    const context = {
      createWaveShaper: vi
        .fn()
        .mockReturnValueOnce(firstLimiter)
        .mockReturnValueOnce(secondLimiter),
    } as unknown as AudioContext;

    const nodes: {
      gain: GainNode;
      limiter: WaveShaperNode | null;
      source: MediaElementAudioSourceNode;
    } = { gain, limiter: null, source };

    updateAudioTrackLimiter(context, nodes, audioMix, limiterAt(-1));
    expect(nodes.limiter).toBe(firstLimiter);
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.connect).toHaveBeenLastCalledWith(firstLimiter);
    expect(firstLimiter.connect).toHaveBeenCalledWith(audioMix);

    updateAudioTrackLimiter(context, nodes, audioMix, undefined);
    expect(gain.disconnect).toHaveBeenCalledTimes(2);
    expect(firstLimiter.disconnect).toHaveBeenCalledTimes(1);
    expect(nodes.limiter).toBeNull();
    expect(gain.connect).toHaveBeenLastCalledWith(audioMix);

    updateAudioTrackLimiter(context, nodes, audioMix, limiterAt(-2));
    expect(nodes.limiter).toBe(secondLimiter);
    expect(gain.disconnect).toHaveBeenCalledTimes(3);
    expect(gain.connect).toHaveBeenLastCalledWith(secondLimiter);
    expect(secondLimiter.connect).toHaveBeenCalledWith(audioMix);

    disconnectAudioTrackRuntime(nodes);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.disconnect).toHaveBeenCalledTimes(4);
    expect(secondLimiter.disconnect).toHaveBeenCalledTimes(1);
  });
});
