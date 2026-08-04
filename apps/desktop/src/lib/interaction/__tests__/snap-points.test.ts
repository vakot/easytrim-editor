import { describe, expect, it } from "vitest";

import { snapToNearestPoint } from "../snap-points";

describe("snapToNearestPoint", () => {
  it("returns the closest point within reach", () => {
    expect(snapToNearestPoint(22, [0, 25, 50], 2)).toBeNull();
    expect(snapToNearestPoint(24, [0, 25, 50], 3)).toBe(25);
  });

  it("returns the later point when candidates are equally close", () => {
    expect(snapToNearestPoint(25, [0, 50], 25)).toBe(50);
  });
});
