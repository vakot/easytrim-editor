import { describe, expect, it } from "vitest";

import {
  frameCountFor,
  framePresentationMicros,
  frameToPlaybackMicros,
  microsToFrame,
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

  it("holds each frame for its whole duration and reaches EOF only at the duration", () => {
    const rate = { denominator: 1, numerator: 30 };
    expect(presentedFrameAt(1_966_667, 60, 2_000_000, rate)).toBe(59);
    expect(presentedFrameAt(1_999_999, 60, 2_000_000, rate)).toBe(59);
    expect(presentedFrameAt(2_000_000, 60, 2_000_000, rate)).toBe(60);
    // A partial final frame lasts until EOF.
    expect(presentedFrameAt(1_466_999, 44, 1_467_000, rate)).toBe(43);
    expect(presentedFrameAt(1_467_000, 44, 1_467_000, rate)).toBe(44);
  });

  it("presents a frame from its midpoint and EOF from the final frame", () => {
    // OBS MKV at 60 fps stores millisecond timestamps (6.067, 6.083, 6.100); Chromium shows the
    // previous frame for a seek to 6.0833, but the midpoints address each frame unambiguously.
    const rate = { denominator: 1, numerator: 60 };
    expect(framePresentationMicros(365, 367, 6_122_000, rate)).toBe(6_091_667);
    expect(framePresentationMicros(366, 367, 6_122_000, rate)).toBe(6_111_000);
    expect(framePresentationMicros(367, 367, 6_122_000, rate)).toBe(6_111_000);
    expect(framePresentationMicros(0, 367, 6_122_000, rate)).toBe(8_334);
    expect(framePresentationMicros(0, 0, 0, rate)).toBe(0);
  });
});
