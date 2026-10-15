import { describe, expect, it } from "vitest";

import {
  alignAudioActivityRangesToFrames,
  audioActivityRangesFromSilence,
} from "../audio-activity";
import { createNominalFrameIndex } from "../frame-index";

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

describe("alignAudioActivityRangesToFrames", () => {
  // 10 fps: frame boundaries every 100 ms.
  const index = createNominalFrameIndex(1_000_000, { numerator: 10, denominator: 1 });

  it("moves range edges to the nearest frame boundary", () => {
    expect(
      alignAudioActivityRangesToFrames([{ startMicros: 120_000, endMicros: 460_000 }], index),
    ).toEqual([{ startMicros: 100_000, endMicros: 500_000 }]);
  });

  it("drops ranges shorter than a frame and joins ranges that now touch", () => {
    expect(
      alignAudioActivityRangesToFrames(
        [
          { startMicros: 10_000, endMicros: 40_000 },
          { startMicros: 210_000, endMicros: 390_000 },
          { startMicros: 410_000, endMicros: 700_000 },
        ],
        index,
      ),
    ).toEqual([{ startMicros: 200_000, endMicros: 700_000 }]);
  });
});
