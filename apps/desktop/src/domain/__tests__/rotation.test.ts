import { describe, expect, it } from "vitest";

import { rotateCrop } from "../rotation";

describe("rotation", () => {
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
