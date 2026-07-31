import { describe, expect, it } from "vitest";

import { clampPlaybackMicros, formatPlaybackTime, frameDurationMicros } from "./playback";

describe("playback domain", () => {
  it("preserves fractional frame-rate timing", () => {
    expect(frameDurationMicros({ numerator: 60_000, denominator: 1_001 })).toBe(16_683);
    expect(frameDurationMicros({ numerator: 30_000, denominator: 1_001 })).toBe(33_367);
  });

  it("uses a bounded fallback when frame-rate metadata is unavailable", () => {
    expect(frameDurationMicros(undefined)).toBe(100_000);
  });

  it("clamps playback to the complete source", () => {
    expect(clampPlaybackMicros(-1, 5_000_000)).toBe(0);
    expect(clampPlaybackMicros(2_500_000, 5_000_000)).toBe(2_500_000);
    expect(clampPlaybackMicros(8_000_000, 5_000_000)).toBe(5_000_000);
  });

  it("formats source time with frame precision", () => {
    expect(formatPlaybackTime(70_500_000, { numerator: 60, denominator: 1 })).toBe("00:01:10:30f");
  });
});
