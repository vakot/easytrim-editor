import { describe, expect, it } from "vitest";

import { previewTransitionFor } from "../preview-transition";

describe("previewTransitionFor", () => {
  it("disables geometry easing during crop pointer movement", () => {
    expect(previewTransitionFor(true, false)).toMatchObject({ duration: 0 });
  });

  it("disables transitions when reduced motion is requested", () => {
    expect(previewTransitionFor(false, true)).toMatchObject({ duration: 0 });
  });

  it("uses the shared transition for discrete transform changes", () => {
    expect(previewTransitionFor(false, false)).toEqual({
      duration: 0.24,
      ease: "easeInOut",
    });
  });
});
