import { describe, expect, it } from "vitest";

import type { SilenceRange } from "@/lib/tauri/media.types";

import { findNextSegment, findPreviousSegment } from "../segment-navigation";

const silenceRanges: SilenceRange[] = [
  { endMicros: 5_000_000, startMicros: 4_000_000 },
  { endMicros: 10_000_000, startMicros: 8_000_000 },
];

describe("segment navigation", () => {
  it("finds the nearest earlier scene or silence end", () => {
    expect(findPreviousSegment([2_000_000, 7_000_000], silenceRanges, 6_000_000, 0)).toBe(
      5_000_000,
    );
  });

  it("finds the nearest later scene or silence boundary", () => {
    expect(findNextSegment([2_000_000, 7_000_000], silenceRanges, 6_000_000)).toBe(7_000_000);
  });

  it("uses silent range ends for previous and next navigation", () => {
    expect(findPreviousSegment([], silenceRanges, 7_000_000)).toBe(5_000_000);
    expect(findNextSegment([], silenceRanges, 4_000_000)).toBe(5_000_000);
    expect(findNextSegment([], silenceRanges, 6_000_000)).toBe(10_000_000);
  });

  it("includes the first scene start when navigating backward", () => {
    expect(findPreviousSegment([], [], 3_000_000, 1_000_000)).toBe(1_000_000);
  });

  it("does not select a boundary at the current playhead", () => {
    expect(findPreviousSegment([2_000_000], [], 2_000_000)).toBeUndefined();
    expect(findNextSegment([2_000_000], [], 2_000_000)).toBeUndefined();
  });
});
