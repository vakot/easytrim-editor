import { describe, expect, it, vi } from "vitest";

import {
  connectAudioTrackRuntime,
  connectPlaybackAudioGraph,
  disconnectAudioTrackRuntime,
} from "../audio-playback-graph";

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

  it("applies Track Volume after the processed track input and before the mix", () => {
    const input = { connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode;
    const gain = { connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode;
    const audioMix = { connect: vi.fn() } as unknown as GainNode;
    const context = {
      createBiquadFilter: vi.fn(),
      createGain: vi.fn().mockReturnValueOnce(input).mockReturnValueOnce(gain),
    } as unknown as AudioContext;

    const nodes = connectAudioTrackRuntime(context, audioMix);

    expect(input.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(audioMix);
    // Every filter is rendered by the compiled FFmpeg chain, never by WebAudio.
    expect(context.createBiquadFilter).not.toHaveBeenCalled();

    disconnectAudioTrackRuntime(nodes);

    expect(input.disconnect).toHaveBeenCalledOnce();
    expect(gain.disconnect).toHaveBeenCalledOnce();
  });
});
