import { describe, expect, it } from "vitest";

import { timelinePanelSizeConstraints } from "../timeline-pane-sizing";

describe("timelinePanelSizeConstraints", () => {
  it("uses the timeline as the minimum and one track as the default", () => {
    expect(timelinePanelSizeConstraints(1)).toEqual({
      minSize: 170,
      defaultSize: 319,
      maxSize: 319,
    });
  });

  it("uses the timeline alone when no audio tracks are present", () => {
    expect(timelinePanelSizeConstraints(0)).toEqual({
      minSize: 170,
      defaultSize: 170,
      maxSize: 170,
    });
  });

  it("adds one fixed row step for each additional track", () => {
    expect(timelinePanelSizeConstraints(3)).toEqual({
      minSize: 170,
      defaultSize: 319,
      maxSize: 431,
    });
  });
});
