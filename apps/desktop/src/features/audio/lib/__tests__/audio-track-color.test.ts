import { describe, expect, it } from "vitest";

import { audioTrackColor } from "../audio-track-color";

describe("audioTrackColor", () => {
  it("returns a stable, stream-specific color", () => {
    expect(audioTrackColor(2)).toBe(audioTrackColor(2));
    expect(audioTrackColor(2)).not.toBe(audioTrackColor(4));
  });
});
