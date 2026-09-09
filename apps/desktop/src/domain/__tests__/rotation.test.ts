import { describe, expect, it } from "vitest";

import { rotateCrop, rotateDegrees } from "../rotation";

describe("rotation", () => {
  it("wraps clockwise and counterclockwise rotations through quarter turns", () => {
    expect(rotateDegrees(270, "clockwise")).toBe(0);
    expect(rotateDegrees(0, "counterclockwise")).toBe(270);
    expect(rotateDegrees(90, "clockwise")).toBe(180);
  });

  it("rotates crop bounds with the image", () => {
    const crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.6 };

    expectCrop(rotateCrop(crop, 90), { x: 0.2, y: 0.1, width: 0.6, height: 0.5 });
    expectCrop(rotateCrop(crop, 180), { x: 0.4, y: 0.2, width: 0.5, height: 0.6 });
    expectCrop(rotateCrop(crop, 270), { x: 0.2, y: 0.4, width: 0.6, height: 0.5 });
  });
});

function expectCrop(
  actual: ReturnType<typeof rotateCrop>,
  expected: ReturnType<typeof rotateCrop>,
) {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.width).toBeCloseTo(expected.width);
  expect(actual.height).toBeCloseTo(expected.height);
}
