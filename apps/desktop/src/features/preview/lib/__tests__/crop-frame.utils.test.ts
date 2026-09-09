import { describe, expect, it } from "vitest";

import { scaleFrameToSourceBounds } from "../crop-frame.utils";

describe("scaleFrameToSourceBounds", () => {
  it("keeps a preview below intrinsic source dimensions", () => {
    expect(
      scaleFrameToSourceBounds({ width: 4000, height: 2250 }, { width: 1920, height: 1080 }),
    ).toEqual({
      frame: { width: 1920, height: 1080 },
      scale: 0.48,
    });
  });

  it("does not enlarge a preview that already fits", () => {
    expect(
      scaleFrameToSourceBounds({ width: 640, height: 360 }, { width: 1920, height: 1080 }),
    ).toEqual({
      frame: { width: 640, height: 360 },
      scale: 1,
    });
  });
});
