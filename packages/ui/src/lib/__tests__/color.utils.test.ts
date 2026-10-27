import { describe, expect, it } from "vitest";

import {
  hexToHsv,
  hsvFromSpectrumPosition,
  hsvToHex,
  hueFromPosition,
  positionFromHue,
  positionFromSaturation,
  positionFromValue,
  saturationFromPosition,
  valueFromPosition,
} from "../color.utils";

describe("HSV color utilities", () => {
  it("keeps slider endpoints distinct while normalizing equivalent color hues", () => {
    expect(hueFromPosition(0, 100)).toBe(0);
    expect(hueFromPosition(100, 100)).toBe(360);
    expect(hueFromPosition(-10, 100)).toBe(0);
    expect(hueFromPosition(110, 100)).toBe(360);
    expect(hueFromPosition(10, 0)).toBe(0);
    expect(hsvToHex(0, 100, 100)).toBe("#ff0000");
    expect(hsvToHex(360, 100, 100)).toBe("#ff0000");

    for (const ratio of [0, 0.125, 0.5, 0.875, 1]) {
      const x = ratio * 193;
      const y = ratio * 257;
      const saturation = saturationFromPosition(x, 193);
      const value = valueFromPosition(y, 257);
      const hue = hueFromPosition(x, 193);

      expect(positionFromSaturation(saturation)).toBeCloseTo(ratio);
      expect(positionFromValue(value)).toBeCloseTo(ratio);
      expect(positionFromHue(hue)).toBeCloseTo(ratio);
    }
  });

  it("clamps spectrum coordinates and retains hue for grayscale and black states", () => {
    expect(hsvFromSpectrumPosition(25, 0, 100, 100, 315)).toEqual({
      hue: 315,
      saturation: 25,
      value: 100,
    });
    expect(hsvFromSpectrumPosition(0, 25, 100, 100, 315)).toEqual({
      hue: 315,
      saturation: 0,
      value: 75,
    });
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
      value: 100,
    });
    expect(hexToHsv("#808080").hue).toBe(0);
    expect(hexToHsv("#000000").hue).toBe(0);
  });
});
