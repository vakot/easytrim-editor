import { describe, expect, it } from "vitest";

import {
  cropSelectionFadeTransitionFor,
  previewTransformTransitionFor,
} from "../preview-transition";

describe("preview presentation transitions", () => {
  it("keeps crop pointer movement immediate", () => {
    expect(previewTransformTransitionFor(true, false).duration).toBe(0);
  });

  it("disables all transitions when reduced motion is requested", () => {
    expect(previewTransformTransitionFor(false, true).duration).toBe(0);
    expect(cropSelectionFadeTransitionFor(true).duration).toBe(0);
  });

  it("uses monotonic tweens for transforms and a shorter selection fade", () => {
    expect(previewTransformTransitionFor(false, false)).toMatchObject({
      duration: 0.24,
      ease: "easeInOut",
      type: "tween",
    });
    expect(cropSelectionFadeTransitionFor(false)).toMatchObject({
      duration: 0.2,
      ease: "easeOut",
      type: "tween",
    });
  });
});
