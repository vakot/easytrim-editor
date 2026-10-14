import { describe, expect, it } from "vitest";

import { frameToMicros } from "@/domain/media-time";
import { isValidTrimRange } from "@/domain/trim";

import { createTrimFrameAdapter } from "../trim-frames";

describe("frame-aligned trim", () => {
  it.each([
    { numerator: 30, denominator: 1 },
    { numerator: 60, denominator: 1 },
    { numerator: 24000, denominator: 1001 },
    { numerator: 30000, denominator: 1001 },
    { numerator: 60000, denominator: 1001 },
  ])("preserves boundaries and minimum duration at $numerator/$denominator FPS", (rate) => {
    const count = 500;
    const duration = frameToMicros(count, rate) - 1000;
    const adapter = createTrimFrameAdapter(duration, count, rate);
    for (let end = count - 1; end > 100; end--) {
      const range = adapter.edit({ start: 0, end }, "start", count);
      expect(isValidTrimRange(adapter.toTrim(range))).toBe(true);
      expect(adapter.fromTrim(adapter.toTrim(range))).toEqual(range);
      const moved = adapter.edit(range, "move", count);
      expect(moved.end - moved.start).toBe(range.end - range.start);
      expect(isValidTrimRange(adapter.toTrim(moved))).toBe(true);
      const earliestEnd = adapter.edit(range, "end", -1);
      expect(isValidTrimRange(adapter.toTrim(earliestEnd))).toBe(true);
    }
    expect(adapter.lastFrame).toBe(count - 1);
    // Selecting through the last frame exports through EOF.
    expect(adapter.toTrim({ start: 0, end: count - 1 }).endMicros).toBe(duration);
  });

  it("selects whole frames: the end frame is included in the exported range", () => {
    const rate = { numerator: 30, denominator: 1 };
    const adapter = createTrimFrameAdapter(10_000_000, 300, rate);
    // Frames 30..89 are 60 frames, exported as exactly two seconds.
    expect(adapter.toTrim({ start: 30, end: 89 })).toEqual({
      startMicros: 1_000_000,
      endMicros: 3_000_000,
      sourceDurationMicros: 10_000_000,
    });
    expect(adapter.fromTrim(adapter.toTrim({ start: 30, end: 89 }))).toEqual({
      start: 30,
      end: 89,
    });
  });

  it("keeps sub-second media fully selected", () => {
    const adapter = createTrimFrameAdapter(150000, 9, { numerator: 60, denominator: 1 });
    const full = { start: 0, end: 8 };
    expect(adapter.edit(full, "start", 8)).toEqual(full);
    expect(adapter.edit(full, "end", 1)).toEqual(full);
    expect(adapter.edit(full, "move", 100)).toEqual(full);
  });

  it("rounds an existing non-frame-aligned range outward without mutating it", () => {
    const adapter = createTrimFrameAdapter(5000000, 150, { numerator: 30, denominator: 1 });
    const persisted = { startMicros: 1000001, endMicros: 2000001, sourceDurationMicros: 5000000 };
    expect(adapter.fromTrim(persisted)).toEqual({ start: 30, end: 60 });
    expect(persisted.startMicros).toBe(1000001);
  });
});
