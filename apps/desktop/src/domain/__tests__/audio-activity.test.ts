import { describe, expect, it } from "vitest";

import { audioActivityRangesFromSilence } from "../audio-activity";

describe("audioActivityRangesFromSilence", () => {
  it("returns the source intervals before, between, and after silence", () => {
    expect(
      audioActivityRangesFromSilence(
        [
          { startMicros: 2_000_000, endMicros: 4_000_000 },
          { startMicros: 6_000_000, endMicros: 8_000_000 },
        ],
        10_000_000,
      ),
    ).toEqual([
      { startMicros: 0, endMicros: 2_000_000 },
      { startMicros: 4_000_000, endMicros: 6_000_000 },
      { startMicros: 8_000_000, endMicros: 10_000_000 },
    ]);
  });

  it("handles leading, trailing, full-source, and empty silence", () => {
    expect(audioActivityRangesFromSilence([{ startMicros: 0, endMicros: 2 }], 4)).toEqual([
      { startMicros: 2, endMicros: 4 },
    ]);
    expect(audioActivityRangesFromSilence([{ startMicros: 0, endMicros: 4 }], 4)).toEqual([]);
    expect(audioActivityRangesFromSilence([], 4)).toEqual([{ startMicros: 0, endMicros: 4 }]);
    expect(audioActivityRangesFromSilence([], 0)).toEqual([]);
  });
});
