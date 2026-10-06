import { describe, expect, it } from "vitest";

import { hexToHsv, hsvFromSpectrumPosition, hsvToHex, hueFromPosition } from "../color.utils";

describe("HSV color utilities", () => {
  it("keeps slider endpoints distinct while normalizing equivalent color hues", () => {
    expect(hueFromPosition(0, 100)).toBe(0);
    expect(hueFromPosition(100, 100)).toBe(360);
    expect(hueFromPosition(-10, 100)).toBe(0);
    expect(hueFromPosition(110, 100)).toBe(360);
    expect(hueFromPosition(10, 0)).toBe(0);
    expect(hsvToHex(0, 100, 100)).toBe("#ff0000");
    expect(hsvToHex(360, 100, 100)).toBe("#ff0000");
  });

  it("clamps spectrum coordinates and retains hue for grayscale and black states", () => {
    expect(hsvFromSpectrumPosition(-10, -10, 100, 100, 315)).toEqual({
      hue: 315,
      saturation: 0,
      value: 100,
    });
    expect(hsvFromSpectrumPosition(110, 110, 100, 100, 315)).toEqual({
      hue: 315,
      saturation: 100,
      value: 0,
    });
    expect(hsvFromSpectrumPosition(50, 50, 0, 0, 315)).toEqual({
      hue: 315,
      saturation: 0,
      value: 0,
    });
    expect(hexToHsv("#808080").hue).toBe(0);
    expect(hexToHsv("#000000").hue).toBe(0);
  });
});
