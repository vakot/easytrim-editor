import { describe, expect, it } from "vitest";

import {
  canSetTrimBoundaryAtPlayhead,
  createFullTrimRange,
  isValidTrimRange,
  microsFromTimelinePosition,
  moveTrimBoundary,
  moveTrimRange,
  setTrimBoundaryAtPlayhead,
  snapMovedTrimRangeToPlayhead,
  timelinePercent,
} from "../trim";

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

    expect(movedStart.startMicros).toBe(4_000_000);
    expect(movedEnd.endMicros).toBe(5_000_000);
    expect(isValidTrimRange(movedEnd)).toBe(true);
  });

  it("never permits a selection shorter than one second", () => {
    const range = {
      startMicros: 2_000_000,
      endMicros: 8_000_000,
      sourceDurationMicros: 10_000_000,
    };

    expect(moveTrimBoundary(range, "start", 7_500_000).startMicros).toBe(7_000_000);
    expect(moveTrimBoundary(range, "end", 2_500_000).endMicros).toBe(3_000_000);
    expect(setTrimBoundaryAtPlayhead(range, "start", 7_500_000).startMicros).toBe(7_000_000);
    expect(setTrimBoundaryAtPlayhead(range, "end", 2_500_000).endMicros).toBe(3_000_000);
  });

  it("moves the complete segment without changing its duration and snaps to source edges", () => {
    const range = {
      startMicros: 2_000_000,
      endMicros: 5_000_000,
      sourceDurationMicros: 10_000_000,
    };

    expect(moveTrimRange(range, 6_000_000)).toEqual({
      ...range,
      startMicros: 6_000_000,
      endMicros: 9_000_000,
    });
    expect(moveTrimRange(range, -2_000_000)).toEqual({
      ...range,
      startMicros: 0,
      endMicros: 3_000_000,
    });
    expect(moveTrimRange(range, 9_000_000)).toEqual({
      ...range,
      startMicros: 7_000_000,
      endMicros: 10_000_000,
    });
  });

  it("snaps all three segment points to the playhead", () => {
    const range = {
      startMicros: 10_000_000,
      endMicros: 20_000_000,
      sourceDurationMicros: 60_000_000,
    };

    expect(
      snapMovedTrimRangeToPlayhead(moveTrimRange(range, 30_500_000), 30_000_000, 1_000_000),
    ).toEqual({
      range: { ...range, startMicros: 30_000_000, endMicros: 40_000_000 },
      point: "start",
    });
    expect(
      snapMovedTrimRangeToPlayhead(moveTrimRange(range, 24_500_000), 30_000_000, 1_000_000),
    ).toEqual({
      range: { ...range, startMicros: 25_000_000, endMicros: 35_000_000 },
      point: "center",
    });
    expect(
      snapMovedTrimRangeToPlayhead(moveTrimRange(range, 19_500_000), 30_000_000, 1_000_000),
    ).toEqual({
      range: { ...range, startMicros: 20_000_000, endMicros: 30_000_000 },
      point: "end",
    });
  });

  it("snaps borders regardless of playhead position or movement direction", () => {
    const range = {
      startMicros: 10_000_000,
      endMicros: 20_000_000,
      sourceDurationMicros: 60_000_000,
    };

    expect(
      snapMovedTrimRangeToPlayhead(moveTrimRange(range, 9_500_000), 19_000_000, 1_000_000),
    ).toEqual({
      range: { ...range, startMicros: 9_000_000, endMicros: 19_000_000 },
      point: "end",
    });
    expect(
      snapMovedTrimRangeToPlayhead(moveTrimRange(range, 10_500_000), 9_000_000, 2_000_000),
    ).toEqual({
      range: { ...range, startMicros: 9_000_000, endMicros: 19_000_000 },
      point: "start",
    });
  });

  it("keeps the complete source selected when it is shorter than one second", () => {
    const range = createFullTrimRange(500_000);

    expect(moveTrimBoundary(range, "start", 250_000)).toEqual(range);
    expect(moveTrimBoundary(range, "end", 250_000)).toEqual(range);
    expect(isValidTrimRange(range)).toBe(true);
  });

  it("sets trim boundaries at the playhead and resets a crossed opposite boundary", () => {
    const range = {
      startMicros: 2_000_000,
      endMicros: 8_000_000,
      sourceDurationMicros: 10_000_000,
    };

    expect(setTrimBoundaryAtPlayhead(range, "start", 4_000_000)).toEqual({
      ...range,
      startMicros: 4_000_000,
    });
    expect(setTrimBoundaryAtPlayhead(range, "start", 9_000_000)).toEqual({
      ...range,
      startMicros: 9_000_000,
      endMicros: 10_000_000,
    });
    expect(setTrimBoundaryAtPlayhead(range, "start", 8_000_000)).toEqual({
      ...range,
      startMicros: 8_000_000,
      endMicros: 10_000_000,
    });
    expect(setTrimBoundaryAtPlayhead(range, "end", 6_000_000)).toEqual({
      ...range,
      endMicros: 6_000_000,
    });
    expect(setTrimBoundaryAtPlayhead(range, "end", 1_000_000)).toEqual({
      ...range,
      startMicros: 0,
      endMicros: 1_000_000,
    });
    expect(setTrimBoundaryAtPlayhead(range, "end", 2_000_000)).toEqual({
      ...range,
      startMicros: 0,
      endMicros: 2_000_000,
    });
  });

  it("gates source-edge marks that would create an empty segment", () => {
    const range = createFullTrimRange(10_000_000);

    expect(canSetTrimBoundaryAtPlayhead(range, "start", 10_000_000)).toBe(false);
    expect(canSetTrimBoundaryAtPlayhead(range, "end", 0)).toBe(false);
    expect(setTrimBoundaryAtPlayhead(range, "start", 10_000_000)).toBe(range);
    expect(setTrimBoundaryAtPlayhead(range, "end", 0)).toBe(range);
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
