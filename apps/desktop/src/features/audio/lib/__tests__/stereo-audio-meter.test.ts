import { describe, expect, it, vi } from "vitest";

import {
  amplitudeToMeterLevel,
  createStereoAudioMeterNodes,
  disconnectStereoAudioMeterNodes,
  isMonoAudioMix,
  meterZoneLevels,
  peakAmplitude,
  smoothMeterLevel,
  updatePeakHold,
} from "../stereo-audio-meter";

describe("stereo audio meter", () => {
  it("maps amplitude to the -60 dBFS to 0 dBFS display range", () => {
    expect(amplitudeToMeterLevel(0)).toBe(0);
    expect(amplitudeToMeterLevel(0.001)).toBe(0);
    expect(amplitudeToMeterLevel(0.1)).toBeCloseTo(2 / 3);
    expect(amplitudeToMeterLevel(1)).toBe(1);
    expect(amplitudeToMeterLevel(2)).toBe(1);
    expect(amplitudeToMeterLevel(Number.NaN)).toBe(0);
  });

  it("only mirrors known mono mixes", () => {
    expect(isMonoAudioMix([])).toBe(false);
    expect(isMonoAudioMix([1])).toBe(true);
    expect(isMonoAudioMix([1, 1])).toBe(true);
    expect(isMonoAudioMix([1, 2])).toBe(false);
    expect(isMonoAudioMix([undefined])).toBe(false);
  });

  it("tracks peaks immediately and smoothly decays them toward silence", () => {
    expect(peakAmplitude(new Float32Array([0.1, -0.8, 0.4]))).toBeCloseTo(0.8);
    expect(smoothMeterLevel(0.2, 0.7, 16)).toBe(0.7);
    const decayed = smoothMeterLevel(1, 0, 240);
    expect(decayed).toBeCloseTo(Math.exp(-1));
    expect(smoothMeterLevel(1, 0, 5000)).toBe(0);
  });

  it("splits the live meter fill into safe, warning, and clipping zones", () => {
    expect(meterZoneLevels(0.5)).toEqual({ safe: 0.5, warning: 0, clipping: 0 });
    const warningLevel = meterZoneLevels(0.75);
    expect(warningLevel.safe).toBeCloseTo(2 / 3);
    expect(warningLevel.warning).toBeCloseTo(0.75 - 2 / 3);
    expect(warningLevel.clipping).toBe(0);

    const clippingLevel = meterZoneLevels(0.9);
    expect(clippingLevel.safe).toBeCloseTo(2 / 3);
    expect(clippingLevel.warning).toBeCloseTo(0.85 - 2 / 3);
    expect(clippingLevel.clipping).toBeCloseTo(0.05);

    expect(meterZoneLevels(2)).toEqual({
      safe: 2 / 3,
      warning: 0.85 - 2 / 3,
      clipping: 1 - 0.85,
    });
  });

  it("holds peaks, releases them smoothly, and immediately replaces them with a higher peak", () => {
    const initial = { level: 0, holdRemainingMs: 0 };
    const firstPeak = updatePeakHold(initial, 0.8, 16);
    expect(firstPeak).toEqual({ level: 0.8, holdRemainingMs: 750 });
    expect(updatePeakHold(firstPeak, 0.2, 700)).toEqual({
      level: 0.8,
      holdRemainingMs: 50,
    });

    const falling = updatePeakHold(firstPeak, 0.2, 850);
    expect(falling.holdRemainingMs).toBe(0);
    expect(falling.level).toBeCloseTo(0.6889);
    expect(updatePeakHold(falling, 0.2, 900).level).toBe(0.2);
    expect(updatePeakHold(falling, 0.95, 16)).toEqual({
      level: 0.95,
      holdRemainingMs: 750,
    });
  });

  it("attaches channel analysers as a passive branch and disconnects the branch", () => {
    const left = { fftSize: 0, disconnect: vi.fn() };
    const right = { fftSize: 0, disconnect: vi.fn() };
    const splitter = { connect: vi.fn(), disconnect: vi.fn() };
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const context = {
      createAnalyser: vi.fn().mockReturnValueOnce(left).mockReturnValueOnce(right),
      createChannelSplitter: vi.fn().mockReturnValue(splitter),
    } as unknown as AudioContext;

    const meter = createStereoAudioMeterNodes(context, source as unknown as AudioNode);

    expect(source.connect).toHaveBeenCalledWith(splitter);
    expect(splitter.connect).toHaveBeenNthCalledWith(1, left, 0);
    expect(splitter.connect).toHaveBeenNthCalledWith(2, right, 1);
    expect(meter.left.fftSize).toBe(2048);
    expect(meter.right.fftSize).toBe(2048);

    disconnectStereoAudioMeterNodes(meter);

    expect(source.disconnect).toHaveBeenCalledWith(splitter);
    expect(splitter.disconnect).toHaveBeenCalledOnce();
    expect(left.disconnect).toHaveBeenCalledOnce();
    expect(right.disconnect).toHaveBeenCalledOnce();
    expect(() => disconnectStereoAudioMeterNodes(null)).not.toThrow();
  });
});
