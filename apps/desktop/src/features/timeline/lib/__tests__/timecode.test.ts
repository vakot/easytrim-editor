import { describe, expect, it } from "vitest";

import { formatTimecode } from "../timecode";

describe("formatTimecode", () => {
  const sixty = { numerator: 60, denominator: 1 };

  it("formats a time as clock fields and its frame slot within the second", () => {
    expect(formatTimecode(0, sixty)).toBe("00:00:00:00f");
    expect(formatTimecode(1_450_000, sixty)).toBe("00:00:01:27f");
    expect(formatTimecode(3_723_500_000, sixty)).toBe("01:02:03:30f");
  });

  it("keeps timestamps on a fractional rate's grid in their own slot", () => {
    const ntsc = { numerator: 30_000, denominator: 1_001 };
    // Frame 31 of 29.97 FPS starts at 1.034367 s: slot 1 of second 1.
    expect(formatTimecode(1_034_367, ntsc)).toBe("00:00:01:01f");
    expect(formatTimecode(1_466_667, sixty)).toBe("00:00:01:28f");
  });

  it("shows a skipped slot as a jump instead of renumbering real frames", () => {
    // OBS frames at 1.400 and 1.450 s with the 1.417 and 1.433 s slots missing.
    expect(formatTimecode(1_400_000, sixty)).toBe("00:00:01:24f");
    expect(formatTimecode(1_450_000, sixty)).toBe("00:00:01:27f");
  });

  it("falls back to 30 FPS without a frame rate", () => {
    expect(formatTimecode(1_500_000, undefined)).toBe("00:00:01:15f");
  });

  it("labels consecutive millisecond-rounded frames with consecutive slots", () => {
    // MKV stores 60 FPS frame starts rounded to whole milliseconds, some below the exact slot.
    const labels = [];
    for (let frame = 350; frame <= 362; frame += 1) {
      const micros = Math.round((frame * 1_000) / 60) * 1_000;
      labels.push(formatTimecode(micros, sixty));
    }
    expect(labels).toEqual(
      Array.from({ length: 13 }, (_, index) => {
        const frame = 350 + index;
        const seconds = Math.floor(frame / 60);
        return `00:00:${String(seconds).padStart(2, "0")}:${String(frame % 60).padStart(2, "0")}f`;
      }),
    );
  });
});
