import { describe, expect, it } from "vitest";

import type { AudioActivityRange } from "@/domain/media";

import { createTimelineSnapTargets, findNearestTimelineSnapTarget } from "../timeline-snap";

const audioActivityRanges: AudioActivityRange[] = [
  { endMicros: 5_000_000, startMicros: 4_000_000 },
  { endMicros: 9_000_000, startMicros: 8_000_000 },
];

describe("timeline snap targets", () => {
  it("includes scene boundaries and both ends of every audio activity range in time order", () => {
    expect(createTimelineSnapTargets([2_000_000, 7_000_000], audioActivityRanges)).toEqual([
      2_000_000, 4_000_000, 5_000_000, 7_000_000, 8_000_000, 9_000_000,
    ]);
  });

  it("snaps to either edge of an audio activity range within reach", () => {
    const targets = createTimelineSnapTargets([], audioActivityRanges);

    expect(findNearestTimelineSnapTarget(4_050_000, 1_000, 10_000_000, targets)).toBe(4_000_000);
    expect(findNearestTimelineSnapTarget(4_950_000, 1_000, 10_000_000, targets)).toBe(5_000_000);
  });

  it("ignores targets outside the Shift-snap reach", () => {
    const targets = createTimelineSnapTargets([], audioActivityRanges);

    expect(findNearestTimelineSnapTarget(4_500_000, 1_000, 10_000_000, targets)).toBeNull();
  });
});
