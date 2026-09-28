import { describe, expect, it } from "vitest";

import { findNextSilence, findPreviousSilence } from "../silence-navigation";

const ranges = [
  { startMicros: 1_000_000, endMicros: 2_000_000 },
  { startMicros: 4_000_000, endMicros: 5_000_000 },
];

describe("silence navigation", () => {
  it("moves to the nearest earlier silent range start", () => {
    expect(findPreviousSilence(ranges, 4_500_000)).toBe(4_000_000);
    expect(findPreviousSilence(ranges, 1_000_000)).toBeUndefined();
  });

  it("moves to the nearest later silent range start", () => {
    expect(findNextSilence(ranges, 2_000_000)).toBe(4_000_000);
    expect(findNextSilence(ranges, 4_000_000)).toBeUndefined();
  });
});
