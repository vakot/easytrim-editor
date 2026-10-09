import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import {
  FRAME_RATE_OPTIONS,
  frameRateFromInput,
  frameRateToInput,
  resolutionOptions,
} from "../export-options.utils";

const translate = ((key: string, values?: { height?: number; width?: number }) =>
  key === "export.resolution.sourceOption"
    ? `${values?.width} × ${values?.height} (source)`
    : key) as TFunction;

describe("export resolution options", () => {
  it("uses crop dimensions as the source and preserves their aspect ratio", () => {
    expect(resolutionOptions({ width: 2_560, height: 1_440 }, translate)).toEqual([
      {
        label: "2560 × 1440 (source)",
        value: "2560x1440",
      },
      {
        label: "1080p · 1920 × 1080",
        value: "1920x1080",
      },
    ]);
  });

  it("does not add lower presets when the crop is already below their heights", () => {
    expect(resolutionOptions({ width: 1_280, height: 720 }, translate)).toEqual([
      {
        label: "1280 × 720 (source)",
        value: "1280x720",
      },
    ]);
  });
});

describe("export frame-rate options", () => {
  it("includes lower GIF-friendly suggestions alongside the existing rates", () => {
    expect(FRAME_RATE_OPTIONS).toEqual([6, 10, 15, 24, 25, 30, 50, 60, 120]);
  });

  it.each([
    ["15", { denominator: 1, numerator: 15 }],
    ["23.976 FPS", { denominator: 125, numerator: 2997 }],
    [".5", { denominator: 2, numerator: 1 }],
    ["1/4294967295 FPS", { denominator: 4_294_967_295, numerator: 1 }],
    ["120", { denominator: 1, numerator: 120 }],
  ])("parses valid custom rate %s", (value, expected) => {
    expect(frameRateFromInput(value)).toEqual(expected);
  });

  it.each(["", "0", "-1", "120.01", "abc", "1e2", "0.0000000001"])(
    "rejects invalid custom rate %s",
    (value) => {
      expect(frameRateFromInput(value)).toBeUndefined();
    },
  );

  it("keeps very low valid stored rates editable", () => {
    expect(frameRateToInput({ denominator: 4_294_967_295, numerator: 1 })).toBe("1/4294967295 FPS");
  });

  it("leaves the field empty when matching the source", () => {
    expect(frameRateToInput(undefined)).toBe("");
  });
});
