import { describe, expect, it } from "vitest";

import {
  clampToTrim,
  createFullTrimRange,
  isValidTrimRange,
  microsFromTimelinePosition,
  moveTrimBoundary,
  timelinePercent,
} from "./trim";

describe("trim domain", () => {
  it("initializes the full source in integer microseconds", () => {
    expect(createFullTrimRange(5_000_000)).toEqual({
      startMicros: 0,
      endMicros: 5_000_000,
      sourceDurationMicros: 5_000_000,
    });
  });

  it("clamps both handles and never permits an empty selection", () => {
    const range = createFullTrimRange(5_000_000);
    const movedStart = moveTrimBoundary(range, "start", 8_000_000);
    const movedEnd = moveTrimBoundary(movedStart, "end", -10);

    expect(movedStart.startMicros).toBe(4_999_999);
    expect(movedEnd.endMicros).toBe(5_000_000);
    expect(isValidTrimRange(movedEnd)).toBe(true);
  });

  it("maps pointer positions to bounded source time", () => {
    expect(microsFromTimelinePosition(50, 100, 200, 10_000_000)).toBe(0);
    expect(microsFromTimelinePosition(200, 100, 200, 10_000_000)).toBe(5_000_000);
    expect(microsFromTimelinePosition(400, 100, 200, 10_000_000)).toBe(10_000_000);
  });

  it("maps source time to percentages and clamps playhead time to the selection", () => {
    const range = {
      startMicros: 2_000_000,
      endMicros: 8_000_000,
      sourceDurationMicros: 10_000_000,
    };

    expect(timelinePercent(2_500_000, range.sourceDurationMicros)).toBe(25);
    expect(clampToTrim(500_000, range)).toBe(2_000_000);
    expect(clampToTrim(9_000_000, range)).toBe(8_000_000);
  });

  it("rejects malformed ranges", () => {
    expect(
      isValidTrimRange({
        startMicros: 1_000_000,
        endMicros: 1_000_000,
        sourceDurationMicros: 5_000_000,
      }),
    ).toBe(false);
  });
});
