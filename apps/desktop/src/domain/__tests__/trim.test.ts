import { describe, expect, it } from "vitest";

import {
  advanceDirectionalSnapLatch,
  canSetTrimBoundaryAtPlayhead,
  clampToTrim,
  createDirectionalSnapLatch,
  createFullTrimRange,
  isValidTrimRange,
  microsFromTimelinePosition,
  moveTrimBoundary,
  moveTrimRange,
  playheadAfterSegmentMove,
  playheadAfterTrimBoundaryMove,
  settleDirectionalSnapLatch,
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

  it("holds a followed anchor through its magnetic radius, then ignores it until reversal", () => {
    const movingRight = advanceDirectionalSnapLatch(createDirectionalSnapLatch(), 500_000);
    const held = settleDirectionalSnapLatch(movingRight.latch, true, true);
    expect(held.anchorHeld).toBe(true);

    const withinMagneticRadius = advanceDirectionalSnapLatch(held, 250_000);
    expect(withinMagneticRadius.anchorIgnored).toBe(false);
    expect(withinMagneticRadius.latch.anchorHeld).toBe(true);

    const ignored = settleDirectionalSnapLatch(withinMagneticRadius.latch, false, true);
    const continuingRight = advanceDirectionalSnapLatch(ignored, 250_000);
    expect(continuingRight.anchorIgnored).toBe(true);

    const stationary = advanceDirectionalSnapLatch(continuingRight.latch, 0);
    expect(stationary.anchorIgnored).toBe(true);

    const reversingLeft = advanceDirectionalSnapLatch(stationary.latch, -100_000);
    expect(reversingLeft).toEqual({
      latch: {
        direction: -1,
        ignoredDirection: null,
        anchorHeld: false,
      },
      anchorIgnored: false,
    });
  });

  it("follows a caught border only while the segment keeps moving toward its opposite border", () => {
    const movingRight = {
      startMicros: 10_000_000,
      endMicros: 20_000_000,
      sourceDurationMicros: 60_000_000,
    };

    const beforeRightContact = moveTrimRange(movingRight, 20_000_000);
    const rightContact = moveTrimRange(beforeRightContact, 30_000_000);

    expect(playheadAfterSegmentMove(movingRight, beforeRightContact, 30_000_000, null)).toEqual({
      playheadMicros: 30_000_000,
      boundary: null,
    });
    const caughtRight = playheadAfterSegmentMove(
      beforeRightContact,
      rightContact,
      30_000_000,
      null,
    );

    expect(caughtRight).toEqual({
      playheadMicros: 30_000_000,
      boundary: "start",
    });
    const followedRightRange = moveTrimRange(rightContact, 35_000_000);
    const followedRight = playheadAfterSegmentMove(
      rightContact,
      followedRightRange,
      caughtRight.playheadMicros,
      caughtRight.boundary,
    );

    expect(followedRight).toEqual({
      playheadMicros: 35_000_000,
      boundary: "start",
    });
    const releasedRight = playheadAfterSegmentMove(
      followedRightRange,
      moveTrimRange(followedRightRange, 33_000_000),
      followedRight.playheadMicros,
      followedRight.boundary,
    );

    expect(releasedRight).toEqual({
      playheadMicros: 35_000_000,
      boundary: null,
    });

    const movingLeft = {
      startMicros: 40_000_000,
      endMicros: 50_000_000,
      sourceDurationMicros: 60_000_000,
    };

    const beforeLeftContact = moveTrimRange(movingLeft, 25_000_000);
    const leftContact = moveTrimRange(beforeLeftContact, 20_000_000);

    expect(playheadAfterSegmentMove(movingLeft, beforeLeftContact, 30_000_000, null)).toEqual({
      playheadMicros: 30_000_000,
      boundary: null,
    });
    const caughtLeft = playheadAfterSegmentMove(beforeLeftContact, leftContact, 30_000_000, null);
    expect(caughtLeft).toEqual({
      playheadMicros: 30_000_000,
      boundary: "end",
    });
    const followedLeftRange = moveTrimRange(leftContact, 15_000_000);
    const followedLeft = playheadAfterSegmentMove(
      leftContact,
      followedLeftRange,
      caughtLeft.playheadMicros,
      caughtLeft.boundary,
    );

    expect(followedLeft).toEqual({
      playheadMicros: 25_000_000,
      boundary: "end",
    });

    const reversedRightRange = moveTrimRange(followedLeftRange, 17_000_000);
    const releasedLeft = playheadAfterSegmentMove(
      followedLeftRange,
      reversedRightRange,
      followedLeft.playheadMicros,
      followedLeft.boundary,
    );

    expect(releasedLeft).toEqual({
      playheadMicros: 25_000_000,
      boundary: null,
    });

    const oppositeContactRange = moveTrimRange(reversedRightRange, 25_000_000);
    const caughtOpposite = playheadAfterSegmentMove(
      reversedRightRange,
      oppositeContactRange,
      releasedLeft.playheadMicros,
      releasedLeft.boundary,
    );

    expect(caughtOpposite).toEqual({
      playheadMicros: 25_000_000,
      boundary: "start",
    });
    expect(
      playheadAfterSegmentMove(
        oppositeContactRange,
        moveTrimRange(oppositeContactRange, 30_000_000),
        caughtOpposite.playheadMicros,
        caughtOpposite.boundary,
      ),
    ).toEqual({
      playheadMicros: 30_000_000,
      boundary: "start",
    });
  });

  it("keeps the complete source selected when it is shorter than one second", () => {
    const range = createFullTrimRange(500_000);

    expect(moveTrimBoundary(range, "start", 250_000)).toEqual(range);
    expect(moveTrimBoundary(range, "end", 250_000)).toEqual(range);
    expect(isValidTrimRange(range)).toBe(true);
  });

  it("preserves the playhead unless a shrinking boundary crosses it", () => {
    const range = {
      startMicros: 2_000_000,
      endMicros: 8_000_000,
      sourceDurationMicros: 10_000_000,
    };

    expect(
      playheadAfterTrimBoundaryMove(
        range,
        { ...range, startMicros: 6_000_000 },
        "start",
        5_000_000,
      ),
    ).toBe(6_000_000);
    expect(
      playheadAfterTrimBoundaryMove(
        range,
        { ...range, startMicros: 1_000_000 },
        "start",
        5_000_000,
      ),
    ).toBe(5_000_000);
    expect(
      playheadAfterTrimBoundaryMove(range, { ...range, endMicros: 4_000_000 }, "end", 5_000_000),
    ).toBe(4_000_000);
    expect(
      playheadAfterTrimBoundaryMove(range, { ...range, endMicros: 9_000_000 }, "end", 5_000_000),
    ).toBe(5_000_000);
  });

  it("releases a directly dragged border on reversal until it approaches again", () => {
    const range = {
      startMicros: 2_000_000,
      endMicros: 8_000_000,
      sourceDurationMicros: 10_000_000,
    };

    const caughtEnd = { ...range, endMicros: 5_000_000 };
    const reversedEnd = { ...range, endMicros: 7_000_000 };
    const beforeEndContact = { ...range, endMicros: 6_000_000 };

    expect(playheadAfterTrimBoundaryMove(range, caughtEnd, "end", 5_000_000)).toBe(5_000_000);
    expect(playheadAfterTrimBoundaryMove(caughtEnd, reversedEnd, "end", 5_000_000)).toBe(5_000_000);
    expect(playheadAfterTrimBoundaryMove(reversedEnd, beforeEndContact, "end", 5_000_000)).toBe(
      5_000_000,
    );
    expect(
      playheadAfterTrimBoundaryMove(
        beforeEndContact,
        { ...range, endMicros: 4_000_000 },
        "end",
        5_000_000,
      ),
    ).toBe(4_000_000);

    const caughtStart = { ...range, startMicros: 5_000_000 };
    const reversedStart = { ...range, startMicros: 3_000_000 };
    const beforeStartContact = { ...range, startMicros: 4_000_000 };

    expect(playheadAfterTrimBoundaryMove(range, caughtStart, "start", 5_000_000)).toBe(5_000_000);
    expect(playheadAfterTrimBoundaryMove(caughtStart, reversedStart, "start", 5_000_000)).toBe(
      5_000_000,
    );
    expect(
      playheadAfterTrimBoundaryMove(reversedStart, beforeStartContact, "start", 5_000_000),
    ).toBe(5_000_000);
    expect(
      playheadAfterTrimBoundaryMove(
        beforeStartContact,
        { ...range, startMicros: 6_000_000 },
        "start",
        5_000_000,
      ),
    ).toBe(6_000_000);
  });

  it("does not snap a shrinking boundary when the playhead was already outside it", () => {
    const range = {
      startMicros: 2_000_000,
      endMicros: 8_000_000,
      sourceDurationMicros: 10_000_000,
    };

    expect(
      playheadAfterTrimBoundaryMove(
        range,
        { ...range, startMicros: 3_000_000 },
        "start",
        1_000_000,
      ),
    ).toBe(1_000_000);
    expect(
      playheadAfterTrimBoundaryMove(range, { ...range, endMicros: 7_000_000 }, "end", 9_000_000),
    ).toBe(9_000_000);
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
