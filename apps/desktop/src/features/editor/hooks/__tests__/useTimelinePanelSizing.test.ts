import { describe, expect, it } from "vitest";

import { timelinePanelTargetSize } from "../useTimelinePanelSizing";

const constraints = {
  minSize: 180,
  defaultSize: 276,
  maxSize: 620,
};

describe("timelinePanelTargetSize", () => {
  it("uses the measured one-track default for the first source", () => {
    expect(timelinePanelTargetSize(400, constraints, true)).toBe(276);
  });

  it("preserves the current size when the next source accepts it", () => {
    expect(timelinePanelTargetSize(400, constraints, false)).toBe(400);
  });

  it("clamps the preserved size to the next source bounds", () => {
    expect(timelinePanelTargetSize(100, constraints, false)).toBe(180);
    expect(timelinePanelTargetSize(900, constraints, false)).toBe(620);
  });

  it("restores a remembered size after a pane is shown again", () => {
    expect(timelinePanelTargetSize(180, constraints, false, 420)).toBe(420);
  });

  it("clamps a remembered size to the current pane bounds", () => {
    expect(timelinePanelTargetSize(180, constraints, false, 900)).toBe(620);
  });
});
