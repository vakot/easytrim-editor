import { describe, expect, it } from "vitest";

import { timelinePanelSizeConstraints } from "../timeline-pane-sizing";

describe("timelinePanelSizeConstraints", () => {
  it("uses the timeline as the minimum and one track as the default", () => {
    expect(timelinePanelSizeConstraints(1)).toEqual({
      minSize: 148,
      defaultSize: 274,
      maxSize: 274,
    });
  });

  it("uses the timeline alone when no audio tracks are present", () => {
    expect(timelinePanelSizeConstraints(0)).toEqual({
      minSize: 148,
      defaultSize: 148,
      maxSize: 148,
    });
  });

  it("adds one fixed row step for each additional track", () => {
    expect(timelinePanelSizeConstraints(3)).toEqual({
      minSize: 148,
      defaultSize: 274,
      maxSize: 402,
    });
  });
});
