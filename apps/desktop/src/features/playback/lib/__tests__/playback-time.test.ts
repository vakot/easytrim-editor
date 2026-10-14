import { describe, expect, it } from "vitest";

import { frameCountFor, frameToPlaybackMicros, microsToFrame } from "../playback-time";

describe("playback frame conversion", () => {
  const fractionalRate = { denominator: 1_001, numerator: 30_000 };

  it("uses fractional frame rates and treats the frame count as EOF", () => {
    expect(frameCountFor(10_010_000, fractionalRate)).toBe(300);
    expect(frameToPlaybackMicros(30, 300, 10_010_000, fractionalRate)).toBe(1_001_000);
    expect(microsToFrame(10_010_000, fractionalRate, 300)).toBe(300);
  });

  it("clamps frame positions to the EOF boundary", () => {
    expect(frameToPlaybackMicros(300, 300, 10_011_000, fractionalRate)).toBe(10_011_000);
    expect(frameToPlaybackMicros(0, 300, 10_011_000, fractionalRate)).toBe(0);
    expect(microsToFrame(20_000_000, fractionalRate, 31)).toBe(31);
    expect(microsToFrame(-1, fractionalRate, 31)).toBe(0);
    expect(microsToFrame(1, undefined, 31)).toBe(0);
    expect(microsToFrame(1, fractionalRate, 0)).toBe(0);
  });
});
