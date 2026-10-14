import { describe, expect, it } from "vitest";

import { playbackRange } from "../playback";

describe("playback domain", () => {
  it("uses either the complete timeline or selected segment as playback bounds", () => {
    expect(playbackRange(60_000_000, 10_000_000, 20_000_000, false)).toEqual({
      startMicros: 0,
      endMicros: 60_000_000,
    });
    expect(playbackRange(60_000_000, 10_000_000, 20_000_000, true)).toEqual({
      startMicros: 10_000_000,
      endMicros: 20_000_000,
    });
  });

  it("clamps the segment to the source", () => {
    expect(playbackRange(5_000_000, -1, 8_000_000, true)).toEqual({
      startMicros: 0,
      endMicros: 5_000_000,
    });
  });
});
