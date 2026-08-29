import { describe, expect, it } from "vitest";

import { snapCropToGuides } from "../crop-snapping.utils";

const threshold = { x: 0.03, y: 0.03 };

describe("snapCropToGuides", () => {
  it("snaps the active resize edge to a nearby guide", () => {
    expect(
      snapCropToGuides({ x: 0.26, y: 0.2, width: 0.5, height: 0.4 }, "left", threshold),
    ).toEqual({ x: 0.25, y: 0.2, width: 0.51, height: 0.4 });
  });

  it("snaps both axes when resizing a corner", () => {
    expect(
      snapCropToGuides({ x: 0.2, y: 0.2, width: 0.56, height: 0.56 }, "bottom-right", threshold),
    ).toEqual({ x: 0.2, y: 0.2, width: 0.55, height: 0.55 });
  });

  it("snaps the nearest crop edge when moving", () => {
    expect(
      snapCropToGuides({ x: 0.24, y: 0.49, width: 0.3, height: 0.2 }, "move", threshold),
    ).toEqual({ x: 0.25, y: 0.5, width: 0.3, height: 0.2 });
  });
});
