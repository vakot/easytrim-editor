import { describe, expect, it } from "vitest";

import { webcamPositionStyle } from "./webcam-positions";

describe("webcamPositionStyle", () => {
  it.each([
    ["topLeft", { top: "0%", left: "0%" }],
    ["topRight", { top: "0%", right: "0%" }],
    ["bottomLeft", { bottom: "0%", left: "0%" }],
    ["bottomRight", { bottom: "0%", right: "0%" }],
  ] as const)("places %s directly against its viewport corner", (position, expected) => {
    expect(webcamPositionStyle(position)).toEqual(expected);
  });

  it("keeps offset presets inset", () => {
    expect(webcamPositionStyle("bottomRightOffset")).toEqual({
      bottom: "8.9%",
      right: "8.9%",
    });
  });
});
