import { describe, expect, it } from "vitest";

import { PREVIEW_TRANSITION_DURATION, previewTransitionFor } from "../preview-transition";

describe("preview presentation transitions", () => {
  it("keeps crop pointer movement immediate", () => {
    expect(previewTransitionFor(true, false).duration).toBe(0);
  });

  it("disables all transitions when reduced motion is requested", () => {
    expect(previewTransitionFor(false, true).duration).toBe(0);
  });

  it("uses one 300ms tween for every animated Preview layer", () => {
    expect(PREVIEW_TRANSITION_DURATION).toBe(0.3);
    expect(previewTransitionFor(false, false)).toMatchObject({
      duration: PREVIEW_TRANSITION_DURATION,
      ease: "easeInOut",
      type: "tween",
    });
  });

  it("keeps initial and source mounts immediate", () => {
    expect(previewTransitionFor(true, false).duration).toBe(0);
  });
});
