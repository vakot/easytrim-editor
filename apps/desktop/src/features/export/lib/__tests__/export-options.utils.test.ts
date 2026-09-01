import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { resolutionOptions } from "../export-options.utils";

const translate = ((key: string, values?: { height?: number; width?: number }) =>
  key === "export.options.sourceResolution"
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
