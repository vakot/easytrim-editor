import { describe, expect, it } from "vitest";

import {
  frameCountFor,
  frameToPlaybackMicros,
  microsToFrame,
  playheadFrameAt,
  presentedFrameAt,
} from "../playback-time";

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

  it("reports the presented frame at every rounded fractional-rate boundary", () => {
    const duration = frameToPlaybackMicros(300, 300, 10_010_000, fractionalRate);
    for (let frame = 0; frame < 300; frame += 1) {
      const start = frameToPlaybackMicros(frame, 300, duration, fractionalRate);
      expect(presentedFrameAt(start, 300, duration, fractionalRate)).toBe(frame);
      expect(presentedFrameAt(start - 1, 300, duration, fractionalRate)).toBe(
        Math.max(0, frame - 1),
      );
    }
    expect(presentedFrameAt(duration, 300, duration, fractionalRate)).toBe(300);
  });

  it("moves the playhead continuously within a frame and reaches EOF at the duration", () => {
    const rate = { denominator: 1, numerator: 30 };
    expect(playheadFrameAt(1_983_334, 60, 2_000_000, rate)).toBeCloseTo(59.5, 3);
    expect(playheadFrameAt(1_999_999, 60, 2_000_000, rate)).toBeLessThan(60);
    expect(playheadFrameAt(2_000_000, 60, 2_000_000, rate)).toBe(60);
    // A partial final frame still ends at EOF.
    expect(playheadFrameAt(1_467_000, 44, 1_467_000, rate)).toBe(44);
    expect(playheadFrameAt(1_450_000, 44, 1_467_000, rate)).toBeCloseTo(43.5, 1);
  });
});
