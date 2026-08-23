import { describe, expect, it } from "vitest";

import {
  WEBCAM_CORNER_PRESETS,
  webcamOverlayHeight,
  webcamPositionCorner,
  webcamPositionFor,
  webcamPositionIsOffset,
  webcamPositionStyle,
} from "./webcam-positions";

describe("webcamPositionStyle", () => {
  it("exposes only the four corners in the position selector", () => {
    expect(WEBCAM_CORNER_PRESETS.map((preset) => preset.value)).toEqual([
      "topLeft",
      "topRight",
      "bottomLeft",
      "bottomRight",
    ]);
  });

  it.each([
    ["topLeft", { top: "0%", left: "0%" }],
    ["topRight", { top: "0%", right: "0%" }],
    ["bottomLeft", { bottom: "0%", left: "0%" }],
    ["bottomRight", { bottom: "0%", right: "0%" }],
  ] as const)("places %s directly against its viewport corner", (position, expected) => {
    expect(webcamPositionStyle(position)).toEqual(expected);
  });

  it("offsets only from the selected vertical edge", () => {
    expect(webcamPositionStyle("bottomRightOffset")).toEqual({
      bottom: "8%",
      right: "0%",
    });
    expect(webcamPositionStyle("topLeftOffset")).toEqual({ top: "8%", left: "0%" });
  });

  it("maps corner and offset controls to the existing export presets", () => {
    expect(webcamPositionFor("topLeft", false)).toBe("topLeft");
    expect(webcamPositionFor("topLeft", true)).toBe("topLeftOffset");
    expect(webcamPositionCorner("topLeftOffset")).toBe("topLeft");
    expect(webcamPositionIsOffset("topLeftOffset")).toBe(true);
    expect(webcamPositionIsOffset("topLeft")).toBe(false);
  });
});

describe("webcamOverlayHeight", () => {
  it("uses twenty-four percent of the shorter frame side", () => {
    expect(webcamOverlayHeight({ width: 1920, height: 1080 })).toBe(259.2);
    expect(webcamOverlayHeight({ width: 1080, height: 1920 })).toBe(259.2);
  });

  it("updates from the cropped frame dimensions", () => {
    expect(webcamOverlayHeight({ width: 720, height: 1080 })).toBe(172.8);
  });
});
