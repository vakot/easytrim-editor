import { describe, expect, it } from "vitest";

import { syncTimelineGeometry, timelineGeometryVariables } from "../timeline-geometry";

const range = {
  startMicros: 10_000_000,
  endMicros: 40_000_000,
  sourceDurationMicros: 100_000_000,
};

describe("timelineGeometryVariables", () => {
  it("derives shared trim positions from the selected range", () => {
    expect(timelineGeometryVariables(range)).toEqual({
      "--timeline-trim-start": "10%",
      "--timeline-trim-end": "40%",
      "--timeline-trim-end-inset": "60%",
      "--timeline-trim-center": "25%",
    });
  });

  it("synchronizes every timeline layer through the shared element", () => {
    const element = document.createElement("section");

    syncTimelineGeometry(element, range);

    expect(element.style.getPropertyValue("--timeline-trim-start")).toBe("10%");
    expect(element.style.getPropertyValue("--timeline-trim-end")).toBe("40%");
    expect(element.style.getPropertyValue("--timeline-trim-end-inset")).toBe("60%");
    expect(element.style.getPropertyValue("--timeline-trim-center")).toBe("25%");
  });
});
