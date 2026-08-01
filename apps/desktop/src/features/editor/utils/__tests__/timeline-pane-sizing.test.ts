import { describe, expect, it } from "vitest";

import { timelinePanelSizeConstraints } from "../timeline-pane-sizing";

describe("timelinePanelSizeConstraints", () => {
  it("uses the timeline as the minimum and one track as the default", () => {
    expect(
      timelinePanelSizeConstraints({
        timelineHeight: 148.2,
        audioContentHeight: 312.4,
        firstTrackBottom: 126.1,
      }),
    ).toEqual({
      minSize: 149,
      defaultSize: 276,
      maxSize: 462,
    });
  });

  it("uses the complete audio region when no track row is available", () => {
    expect(
      timelinePanelSizeConstraints({
        timelineHeight: 140,
        audioContentHeight: 48,
        firstTrackBottom: null,
      }),
    ).toEqual({
      minSize: 140,
      defaultSize: 188,
      maxSize: 188,
    });
  });

  it("never lets the default exceed the full content height", () => {
    expect(
      timelinePanelSizeConstraints({
        timelineHeight: 140,
        audioContentHeight: 100,
        firstTrackBottom: 130,
      }),
    ).toEqual({
      minSize: 140,
      defaultSize: 240,
      maxSize: 240,
    });
  });
});
