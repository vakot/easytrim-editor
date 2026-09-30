import { describe, expect, it } from "vitest";

import type { AudioActivityRange } from "@/domain/media";

import {
  createTimelineSnapAnchors,
  createTimelineSnapTargets,
  findNearestTimelineSnapAnchor,
} from "../timeline-snap";

const audioActivityRanges: AudioActivityRange[] = [
  { endMicros: 5_000_000, startMicros: 4_000_000 },
  { endMicros: 9_000_000, startMicros: 8_000_000 },
];

describe("timeline snap anchors", () => {
  it("creates scene and audio markers as ordered snapping anchors", () => {
    expect(createTimelineSnapTargets([2_000_000, 7_000_000], audioActivityRanges)).toEqual([
      2_000_000, 4_000_000, 5_000_000, 7_000_000, 8_000_000, 9_000_000,
    ]);
  });

  it("uses the nearest anchor within the shared 12 pixel reach", () => {
    const range = { startMicros: 0, endMicros: 10_000_000, sourceDurationMicros: 10_000_000 };
    const anchors = createTimelineSnapAnchors(7_000_000, range, [4_000_000, 5_000_000]);

    expect(
      findNearestTimelineSnapAnchor(4_050_000, 1_000, 10_000_000, anchors, "playhead"),
    ).toMatchObject({ id: "marker-0" });
    expect(
      findNearestTimelineSnapAnchor(4_500_000, 1_000, 10_000_000, anchors, "playhead"),
    ).toBeNull();
  });

  it("lets the segment center snap while its moving borders remain passive", () => {
    const range = {
      startMicros: 10_000_000,
      endMicros: 20_000_000,
      sourceDurationMicros: 60_000_000,
    };

    const anchors = createTimelineSnapAnchors(35_000_000, range, []);

    expect(
      findNearestTimelineSnapAnchor(34_500_000, 1_000, 60_000_000, anchors, "trim-center"),
    ).toMatchObject({ id: "playhead", timeMicros: 35_000_000 });
    expect(
      findNearestTimelineSnapAnchor(20_000_000, 1_000, 60_000_000, anchors, "trim-center"),
    ).toBeNull();
  });

  it("excludes a moving center when a trim border is dragged and filters unreachable anchors", () => {
    const range = {
      startMicros: 4_000_000,
      endMicros: 5_000_000,
      sourceDurationMicros: 10_000_000,
    };

    const anchors = createTimelineSnapAnchors(8_000_000, range, [3_000_000, 4_100_000]);

    expect(
      findNearestTimelineSnapAnchor(4_000_000, 100, 10_000_000, anchors, "trim-start"),
    ).toMatchObject({ id: "marker-0", timeMicros: 3_000_000 });
    expect(
      findNearestTimelineSnapAnchor(9_950_000, 100, 10_000_000, anchors, "trim-start"),
    ).toBeNull();
  });

  it("filters segment center targets beyond source limits and unreachable half-microsecond alignment", () => {
    const nearStart = {
      startMicros: 1_000_000,
      endMicros: 4_000_001,
      sourceDurationMicros: 10_000_000,
    };

    const anchors = createTimelineSnapAnchors(500_000, nearStart, [2_000_000]);

    expect(
      findNearestTimelineSnapAnchor(1_600_000, 1_000, 10_000_000, anchors, "trim-center"),
    ).toBeNull();
  });
});
