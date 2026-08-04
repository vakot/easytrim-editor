import { describe, expect, it } from "vitest";

import { MIN_CROP_SIZE, moveCrop, resizeCrop } from "./crop-geometry";

describe("crop geometry", () => {
  it("keeps a moved crop inside the source frame", () => {
    expect(moveCrop({ x: 0.2, y: 0.3, width: 0.5, height: 0.4 }, 1, -1)).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 0.4,
    });
  });

  it("resizes only the dragged edges and enforces a minimum crop size", () => {
    const crop = resizeCrop({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, "top-left", 1, 1);
    expect(crop.x).toBe(0.6);
    expect(crop.y).toBe(0.6);
    expect(crop.width).toBeCloseTo(MIN_CROP_SIZE);
    expect(crop.height).toBeCloseTo(MIN_CROP_SIZE);
  });
});
