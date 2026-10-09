import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropResolution } from "@/app/store/slices/crop-slice";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";
import { exportSettingsChangedRequested } from "@/app/store/thunks/export-thunks";
import type {
  ExportSettings,
  GifDithering,
  GifPaletteColors,
  GifPreset,
} from "@/domain/editing-instance";
import { GIF_PRESET_SETTINGS, gifSettingsWithDefaults } from "@/domain/gif-export";

function GifExportOptions() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeInstance = useAppSelector(selectActiveEditingInstance);
  const cropResolution = useAppSelector(selectCropResolution);
  const presetOptions = [
    { value: "compact", label: t("export.gif.preset.compact") },
    { value: "balanced", label: t("export.gif.preset.balanced") },
    { value: "highQuality", label: t("export.gif.preset.highQuality") },
    { value: "custom", label: t("export.gif.preset.custom") },
  ] as const;

  const ditheringOptions = [
    { value: "none", label: t("export.gif.dithering.none") },
    { value: "bayer", label: t("export.gif.dithering.bayer") },
    { value: "sierra2_4a", label: t("export.gif.dithering.sierra2_4a") },
  ] as const;

  if (!activeInstance) return null;
  const settings = gifSettingsWithDefaults(
    activeInstance.gifSettings ?? {
      frameRate: undefined,
      resolution: cropResolution,
    },
  );

  const updateSettings = (updated: ExportSettings) => {
    void dispatch(exportSettingsChangedRequested(updated));
  };

  return (
    <section
      aria-label={t("export.gif.dialog.optionsLabel")}
      className="grid gap-3"
      data-testid="gif-export-options"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="gif-preset">{t("export.gif.preset.label")}</Label>
        <Select
          onValueChange={(value) => {
            const preset = value as GifPreset;
            const presetSettings = preset === "custom" ? {} : GIF_PRESET_SETTINGS[preset];
            updateSettings({ ...settings, ...presetSettings, gifPreset: preset });
          }}
          value={settings.gifPreset}
        >
          <SelectTrigger className="w-full" id="gif-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presetOptions.map(({ label, value }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="gif-palette-colors">{t("export.gif.paletteColors.label")}</Label>
          <Select
            onValueChange={(value) =>
              updateSettings({
                ...settings,
                gifPreset: "custom",
                paletteColors: Number(value) as GifPaletteColors,
              })
            }
            value={String(settings.paletteColors)}
          >
            <SelectTrigger className="w-full" id="gif-palette-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[16, 32, 64, 128, 256].map((colors) => (
                <SelectItem key={colors} value={String(colors)}>
                  {colors}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="gif-dithering">{t("export.gif.dithering.label")}</Label>
          <Select
            onValueChange={(value) =>
              updateSettings({ ...settings, gifPreset: "custom", dithering: value as GifDithering })
            }
            value={settings.dithering}
          >
            <SelectTrigger className="w-full" id="gif-dithering">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ditheringOptions.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

export { GifExportOptions };
