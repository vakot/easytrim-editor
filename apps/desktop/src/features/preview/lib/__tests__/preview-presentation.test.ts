import { describe, expect, it } from "vitest";

import { previewFrameBoundsFor } from "../preview-presentation";

describe("preview frame presentation bounds", () => {
  it("matches the relative contain layout for a normal output", () => {
    expect(previewFrameBoundsFor(800, 600, 16 / 9, false)).toEqual({
      width: 800,
      height: 450,
    });
  });

  it("matches the crop-safe contain layout", () => {
    expect(previewFrameBoundsFor(800, 600, 9 / 16, true)).toEqual({
      width: 306,
      height: 544,
    });
  });
});
