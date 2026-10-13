import { describe, expect, it } from "vitest";

import { frameCountFor, frameToSeconds, secondsToFrame } from "../frame-time";

describe("frame time conversion", () => {
  const fractionalRate = { denominator: 1_001, numerator: 30_000 };

  it("uses a fractional frame rate when estimating a missing frame count", () => {
    expect(frameCountFor(10_000_000, fractionalRate)).toBe(300);
  });

  it("converts frame indices to source seconds without rounding the rate", () => {
    expect(frameToSeconds(30, fractionalRate)).toBe(1.001);
  });

  it("rounds playback time to a valid frame index", () => {
    expect(secondsToFrame(1.001, fractionalRate, 31)).toBe(30);
    expect(secondsToFrame(20, fractionalRate, 31)).toBe(30);
    expect(secondsToFrame(-1, fractionalRate, 31)).toBe(0);
    expect(secondsToFrame(1, fractionalRate, 0)).toBe(0);
  });
});
