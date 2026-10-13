import { describe, expect, it, vi } from "vitest";

import {
  connectAudioTrackRuntime,
  connectPlaybackAudioGraph,
  disconnectAudioTrackRuntime,
  updateAudioTrackHighPass,
} from "../audio-playback-graph";

function parameter() {
  return { setTargetAtTime: vi.fn(), value: 0 };
}

function filter() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    frequency: parameter(),
    Q: parameter(),
    type: "highpass",
  } as unknown as BiquadFilterNode;
}

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

  it("routes live high-pass stages around gain and updates their parameters in place", () => {
    const cleanup = filter();
    const dynamics = filter();
    const finalProtection = filter();
    const input = { connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode;
    const gain = { connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode;
    const audioMix = { connect: vi.fn() } as unknown as GainNode;
    const context = {
      createBiquadFilter: vi
        .fn()
        .mockReturnValueOnce(cleanup)
        .mockReturnValueOnce(dynamics)
        .mockReturnValueOnce(finalProtection),
      createGain: vi.fn().mockReturnValueOnce(input).mockReturnValueOnce(gain),
      currentTime: 2,
    } as unknown as AudioContext;

    const nodes = connectAudioTrackRuntime(context, audioMix);

    expect(input.connect).toHaveBeenCalledWith(cleanup);
    expect(cleanup.connect).toHaveBeenCalledWith(dynamics);
    expect(dynamics.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(finalProtection);
    expect(finalProtection.connect).toHaveBeenCalledWith(audioMix);
    expect(cleanup.Q.value).toBeCloseTo(Math.SQRT1_2);

    updateAudioTrackHighPass(context, nodes, [
      { cutoffHz: 80, stage: "cleanup", type: "highPass" },
      { cutoffHz: 120, stage: "finalProtection", type: "highPass" },
    ]);

    expect(cleanup.frequency.setTargetAtTime).toHaveBeenCalledWith(80, 2, 0.015);
    expect(dynamics.frequency.setTargetAtTime).toHaveBeenCalledWith(0, 2, 0.015);
    expect(finalProtection.frequency.setTargetAtTime).toHaveBeenCalledWith(120, 2, 0.015);

    disconnectAudioTrackRuntime(nodes);

    expect(input.disconnect).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();
    expect(cleanup.disconnect).toHaveBeenCalledOnce();
    expect(dynamics.disconnect).toHaveBeenCalledOnce();
    expect(finalProtection.disconnect).toHaveBeenCalledOnce();
  });
});
