import { describe, expect, it } from "vitest";

import {
  DEFAULT_GIF_ENCODING_SETTINGS,
  GIF_PRESET_SETTINGS,
  gifSettingsWithDefaults,
} from "@/domain/gif-export";

describe("GIF encoding settings", () => {
  it("keeps explicit settings for each quality preset and retains the current Balanced defaults", () => {
    expect(GIF_PRESET_SETTINGS).toEqual({
      compact: { paletteColors: 64, dithering: "bayer", paletteStatsMode: "diff" },
      balanced: { paletteColors: 256, dithering: "sierra2_4a", paletteStatsMode: "diff" },
      highQuality: { paletteColors: 256, dithering: "sierra2_4a", paletteStatsMode: "full" },
    });
    expect(DEFAULT_GIF_ENCODING_SETTINGS).toEqual({
      paletteColors: 256,
      dithering: "sierra2_4a",
      paletteStatsMode: "diff",
    });
  });

  it("supplies Balanced settings when loading a legacy GIF settings object", () => {
    expect(
      gifSettingsWithDefaults({ frameRate: undefined, resolution: { height: 360, width: 640 } }),
    ).toMatchObject({
      gifPreset: "balanced",
      paletteColors: 256,
      paletteStatsMode: "diff",
      dithering: "sierra2_4a",
    });
  });
});
