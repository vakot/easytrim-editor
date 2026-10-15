import { describe, expect, it } from "vitest";

import { microsAtClientX, percentOf, snapToTargets } from "../timeline-scale";

describe("timeline scale", () => {
  it("places times linearly across the timeline", () => {
    expect(percentOf(0, 2_000_000)).toBe(0);
    expect(percentOf(500_000, 2_000_000)).toBe(25);
    expect(percentOf(3_000_000, 2_000_000)).toBe(100);
    expect(percentOf(100, 0)).toBe(0);
  });

  it("maps a pointer to the time under it, clamped to the timeline", () => {
    expect(microsAtClientX(150, 100, 200, 2_000_000)).toBe(500_000);
    expect(microsAtClientX(50, 100, 200, 2_000_000)).toBe(0);
    expect(microsAtClientX(400, 100, 200, 2_000_000)).toBe(2_000_000);
  });

  it("snaps to the nearest target within the pixel threshold", () => {
    const scale = { durationMicros: 2_000_000, thresholdPixels: 12, width: 200 };
    // 12 px are 120 ms on a 200 px timeline of 2 s.
    expect(snapToTargets(1_000_000, [1_100_000, 1_050_000], scale)).toBe(1_050_000);
    expect(snapToTargets(1_000_000, [1_200_000], scale)).toBe(1_000_000);
  });
});
