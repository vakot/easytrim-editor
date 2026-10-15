import { describe, expect, it } from "vitest";

import { createFullTrimRange, isValidTrimRange } from "../trim";

describe("source trim metadata", () => {
  it("creates a full-source range for export state", () => {
    expect(createFullTrimRange(5_000_000)).toEqual({
      startMicros: 0,
      endMicros: 5_000_000,
      sourceDurationMicros: 5_000_000,
    });
  });

  it("validates persisted source ranges", () => {
    expect(
      isValidTrimRange({ startMicros: 0, endMicros: 5_000_000, sourceDurationMicros: 5_000_000 }),
    ).toBe(true);
    expect(
      isValidTrimRange({
        startMicros: 5_000_000,
        endMicros: 5_000_000,
        sourceDurationMicros: 5_000_000,
      }),
    ).toBe(false);
  });
});
