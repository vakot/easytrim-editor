import { describe, expect, it } from "vitest";

import {
  createFrameIndex,
  createNominalFrameIndex,
  createRealFrameIndex,
  framePresentationMicros,
  lastFrameBefore,
} from "../frame-index";
import type { MediaInfo } from "../media";

describe("real frame index", () => {
  // 60 FPS capture that skipped the 1.417 and 1.433 s slots.
  const index = createRealFrameIndex([0, 17_000, 1_383_000, 1_400_000, 1_450_000], 1_467_000);

  it("counts only real frames and ends after the last one", () => {
    expect(index.count).toBe(5);
    expect(index.startOf(4)).toBe(1_450_000);
    expect(index.startOf(5)).toBe(1_467_000);
  });

  it("shows the previous real frame through a gap and never reports the end boundary", () => {
    expect(index.frameAt(0)).toBe(0);
    expect(index.frameAt(16_999)).toBe(0);
    expect(index.frameAt(1_399_999)).toBe(2);
    expect(index.frameAt(1_433_000)).toBe(3);
    expect(index.frameAt(1_450_000)).toBe(4);
    expect(index.frameAt(1_467_000)).toBe(4);
    expect(index.frameAt(-1)).toBe(0);
  });

  it("presents each frame from its midpoint and finds the last frame of a range", () => {
    expect(framePresentationMicros(index, 3)).toBe(1_425_000);
    expect(framePresentationMicros(index, 4)).toBe(1_458_500);
    expect(lastFrameBefore(index, 1_467_000)).toEqual({
      positionMicros: 1_450_000,
      presentationMicros: 1_458_500,
    });
    expect(lastFrameBefore(index, 1_450_000)).toEqual({
      positionMicros: 1_400_000,
      presentationMicros: 1_425_000,
    });
  });
});

describe("nominal frame index", () => {
  const fractionalRate = { denominator: 1_001, numerator: 30_000 };

  it("reports the presented frame at every rounded fractional-rate boundary", () => {
    const index = createNominalFrameIndex(10_010_000, fractionalRate);
    expect(index.count).toBe(300);
    for (let frame = 0; frame < 300; frame += 1) {
      const start = index.startOf(frame);
      expect(index.frameAt(start)).toBe(frame);
      expect(index.frameAt(start - 1)).toBe(Math.max(0, frame - 1));
    }
    expect(index.frameAt(index.endMicros)).toBe(299);
  });

  it("presents a frame from its midpoint", () => {
    const index = createNominalFrameIndex(6_122_000, { denominator: 1, numerator: 60 });
    expect(framePresentationMicros(index, 365)).toBe(6_091_667);
    expect(framePresentationMicros(index, 366)).toBe(6_111_000);
    expect(framePresentationMicros(index, 0)).toBe(8_334);
    expect(framePresentationMicros(createNominalFrameIndex(0, fractionalRate), 0)).toBe(0);
  });
});

describe("frame index for media", () => {
  const media = (frameTimestampsMicros?: number[]) =>
    ({
      durationMicros: 1_467_000,
      video: {
        averageFrameRate: { denominator: 1, numerator: 60 },
        ...(frameTimestampsMicros ? { frameTimestampsMicros } : {}),
      },
    }) as MediaInfo;

  it("uses the real frames when inspection read them", () => {
    expect(createFrameIndex(media([0, 1_450_000])).count).toBe(2);
  });

  it("falls back to the nominal grid without real frames", () => {
    expect(createFrameIndex(media()).count).toBe(88);
    expect(createFrameIndex(null).count).toBe(0);
  });
});
