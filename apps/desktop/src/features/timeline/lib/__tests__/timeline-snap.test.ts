import { describe, expect, it } from "vitest";

import type { AudioActivityRange } from "@/domain/media";

import {
  createTimelineSnapAnchors,
  createTimelineSnapTargets,
  findNearestTimelineSnapAnchor,
  findNearestTimelineSnapTarget,
} from "../timeline-snap";

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

describe("timeline snap anchors", () => {
  it("omits the opposite trim boundary when finding a handle snap", () => {
    const range = {
      endMicros: 5_000_000,
      sourceDurationMicros: 10_000_000,
      startMicros: 4_000_000,
    };

    const anchors = createTimelineSnapAnchors(2_000_000, range, [4_100_000]);

    expect(
      findNearestTimelineSnapAnchor(
        4_900_000,
        100,
        range.sourceDurationMicros,
        anchors,
        "trim-start",
        ["trim-center", "trim-end"],
      ),
    ).toMatchObject({ id: "marker-0", timeMicros: 4_100_000 });
  });

  it("skips center targets outside the range where the segment can move", () => {
    const anchors = [
      { id: "playhead" as const, timeMicros: 1_800_000 },
      { id: "marker-0" as const, timeMicros: 3_000_000 },
    ];

    expect(
      findNearestTimelineSnapAnchor(1_900_000, 100, 10_000_000, anchors, "trim-center", [], {
        minimumMicros: 2_000_000,
        maximumMicros: 8_000_000,
      }),
    ).toMatchObject({ id: "marker-0", timeMicros: 3_000_000 });
  });
});
