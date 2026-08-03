import { describe, expect, it } from "vitest";

import { timelinePanelSizeConstraints } from "../timeline-pane-sizing";

describe("timelinePanelSizeConstraints", () => {
  it("uses the timeline as the minimum and one track as the default", () => {
    expect(timelinePanelSizeConstraints(1)).toEqual({
      minSize: 165,
      defaultSize: 314,
      maxSize: 314,
    });
  });

  it("uses the timeline alone when no audio tracks are present", () => {
    expect(timelinePanelSizeConstraints(0)).toEqual({
      minSize: 165,
      defaultSize: 165,
      maxSize: 165,
    });
  });

  it("adds one fixed row step for each additional track", () => {
    expect(timelinePanelSizeConstraints(3)).toEqual({
      minSize: 165,
      defaultSize: 314,
      maxSize: 426,
    });
  });
});
