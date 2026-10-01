import { describe, expect, it, vi } from "vitest";

import type { AudioTrackState } from "@/app/store/slices/audio-slice";

import { connectAudioTrackLimiter, connectPlaybackAudioGraph } from "../audio-playback-graph";

describe("playback audio graph", () => {
  it("meters per-track limited output before global playback-volume attenuation", () => {
    const destination = {} as AudioNode;
    const splitter = { connect: vi.fn(), disconnect: vi.fn() } as unknown as ChannelSplitterNode;
    const left = { connect: vi.fn(), disconnect: vi.fn(), fftSize: 0 } as unknown as AnalyserNode;
    const right = { connect: vi.fn(), disconnect: vi.fn(), fftSize: 0 } as unknown as AnalyserNode;
    const outputGain = { connect: vi.fn() } as unknown as GainNode;
    const audioMix = { connect: vi.fn() } as unknown as GainNode;
    const limiter = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      oversample: "none",
      curve: null,
    } as unknown as WaveShaperNode;

    const gain = {
      connect: vi.fn().mockReturnValue(limiter),
      disconnect: vi.fn(),
    } as unknown as GainNode;

    const context = {
      createAnalyser: vi.fn().mockReturnValueOnce(left).mockReturnValueOnce(right),
      createChannelSplitter: vi.fn().mockReturnValue(splitter),
      createGain: vi.fn().mockReturnValue(outputGain),
      createWaveShaper: vi.fn().mockReturnValue(limiter),
      destination,
    } as unknown as AudioContext;

    const track = {
      processing: {
        gainDb: 6,
        effects: [{ ceilingDb: -1, stage: "finalProtection", type: "limiter" }],
      },
    } as AudioTrackState;

    const trackLimiter = connectAudioTrackLimiter(context, gain, audioMix, track);
    const output = connectPlaybackAudioGraph(context, audioMix);

    expect(trackLimiter).toBe(limiter);
    expect(gain.connect).toHaveBeenCalledWith(limiter);
    expect(limiter.connect).toHaveBeenCalledWith(audioMix);
    expect(output.meter.source).toBe(audioMix);
    expect(audioMix.connect).toHaveBeenCalledWith(splitter);
    expect(audioMix.connect).toHaveBeenCalledWith(outputGain);
    expect(outputGain.connect).toHaveBeenCalledWith(destination);
  });
});
