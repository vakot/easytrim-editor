import type {
  ExportSettings,
  GifDithering,
  GifPaletteColors,
  GifPaletteStatsMode,
  GifPreset,
} from "./editing-instance";

interface GifEncodingSettings {
  dithering: GifDithering;
  paletteColors: GifPaletteColors;
  paletteStatsMode: GifPaletteStatsMode;
}

const GIF_PRESET_SETTINGS: Record<Exclude<GifPreset, "custom">, GifEncodingSettings> = {
  compact: { paletteColors: 64, dithering: "bayer", paletteStatsMode: "diff" },
  balanced: { paletteColors: 256, dithering: "sierra2_4a", paletteStatsMode: "diff" },
  highQuality: { paletteColors: 256, dithering: "sierra2_4a", paletteStatsMode: "full" },
};

const DEFAULT_GIF_ENCODING_SETTINGS: GifEncodingSettings = GIF_PRESET_SETTINGS.balanced;

function gifSettingsWithDefaults(settings: ExportSettings): ExportSettings & GifEncodingSettings {
  return {
    ...settings,
    paletteColors: settings.paletteColors ?? DEFAULT_GIF_ENCODING_SETTINGS.paletteColors,
    paletteStatsMode: settings.paletteStatsMode ?? DEFAULT_GIF_ENCODING_SETTINGS.paletteStatsMode,
    dithering: settings.dithering ?? DEFAULT_GIF_ENCODING_SETTINGS.dithering,
    gifPreset: settings.gifPreset ?? "balanced",
  };
}

export { DEFAULT_GIF_ENCODING_SETTINGS, GIF_PRESET_SETTINGS, gifSettingsWithDefaults };
export type { GifEncodingSettings };
