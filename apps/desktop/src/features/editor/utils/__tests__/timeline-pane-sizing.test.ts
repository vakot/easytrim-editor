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

  it("keeps the timeline minimum while adding webcam height to expanded sizes", () => {
    expect(timelinePanelSizeConstraints(0, true)).toEqual({
      minSize: 165,
      defaultSize: 270,
      maxSize: 270,
    });
    expect(timelinePanelSizeConstraints(1, true)).toEqual({
      minSize: 165,
      defaultSize: 419,
      maxSize: 419,
    });
    expect(timelinePanelSizeConstraints(3, true)).toEqual({
      minSize: 165,
      defaultSize: 419,
      maxSize: 531,
    });
  });
});
