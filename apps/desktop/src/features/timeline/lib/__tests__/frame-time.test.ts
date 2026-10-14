import { describe, expect, it } from "vitest";

import { formatFrameTimecode } from "../frame-time";

describe("formatFrameTimecode", () => {
  const frameRate = { denominator: 1, numerator: 30 };

  it("labels timecode and keeps the first frame at zero", () => {
    expect(formatFrameTimecode(0, frameRate)).toBe("00:00:00:00f");
  });

  it("formats an EOF frame count as a timecode boundary", () => {
    expect(formatFrameTimecode(100, frameRate)).toBe("00:00:03:10f");
  });
});
