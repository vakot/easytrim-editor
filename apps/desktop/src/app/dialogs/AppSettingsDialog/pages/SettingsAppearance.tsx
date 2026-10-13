import { ChevronsUpDown, Monitor, Moon, Sun } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getThemeCommandId } from "@/app/commands/appearance";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import {
  MAX_UI_SCALE_PERCENT,
  MIN_UI_SCALE_PERCENT,
  UI_SCALE_STEP_PERCENT,
} from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  primaryColorChanged,
  selectPrimaryColor,
  selectThemePreference,
  selectUiScalePercent,
} from "@/app/store/slices/preferences-slice";
import { PRIMARY_COLOR_PRESETS } from "@/app/theme/theme";
import { useTheme } from "@/app/theme/useTheme";
import {
  ColorPicker,
  ColorPickerHue,
  ColorPickerInput,
  ColorPickerPreset,
  ColorPickerSaturationValue,
  ColorPickerSpectrum,
  ColorSample,
} from "@/components/color";
import type { HexColor } from "@/lib/color.types";

import { CommandButton, SettingRow, SettingsSection } from "../components/SettingRow";

const uiScaleOptions = Array.from(
  { length: (MAX_UI_SCALE_PERCENT - MIN_UI_SCALE_PERCENT) / UI_SCALE_STEP_PERCENT + 1 },
  (_, index) => MIN_UI_SCALE_PERCENT + index * UI_SCALE_STEP_PERCENT,
);

function SettingsAppearance() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const { previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();

  const theme = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const [colorPickerSession, setColorPickerSession] = useState(0);
  const colorPickerSessionRef = useRef(colorPickerSession);
  const previousPrimaryColor = useRef(primaryColor);
  const pickerCommitColor = useRef<HexColor | null>(null);

  useLayoutEffect(() => {
    if (previousPrimaryColor.current === primaryColor) return;

    previousPrimaryColor.current = primaryColor;

    if (pickerCommitColor.current === primaryColor) {
      pickerCommitColor.current = null;
      return;
    }

    pickerCommitColor.current = null;
    const nextSession = colorPickerSessionRef.current + 1;
    colorPickerSessionRef.current = nextSession;
    setColorPickerSession(nextSession);
  }, [primaryColor]);

  const colorPresetLabels = {
    amber: t("settings.appearance.primaryColor.presets.amber"),
    blue: t("settings.appearance.primaryColor.presets.blue"),
    emerald: t("settings.appearance.primaryColor.presets.emerald"),
    rose: t("settings.appearance.primaryColor.presets.rose"),
    violet: t("settings.appearance.primaryColor.presets.violet"),
  };

  const themeOptions = [
    {
      id: "system",
      icon: <Monitor aria-hidden="true" />,
      label: t("settings.appearance.theme.options.system"),
    },
    {
      id: "light",
      icon: <Sun aria-hidden="true" />,
      label: t("settings.appearance.theme.options.light"),
    },
    {
      id: "dark",
      icon: <Moon aria-hidden="true" />,
      label: t("settings.appearance.theme.options.dark"),
    },
  ] as const;

  const handleUiScaleChange = async (value: string) => {
    const nextScale = Number(value);

    if (!uiScaleOptions.includes(nextScale) || nextScale === uiScalePercent) return;

    const commandId = nextScale > uiScalePercent ? "ui-scale-zoom-in" : "ui-scale-zoom-out";
    const stepCount = Math.abs(nextScale - uiScalePercent) / UI_SCALE_STEP_PERCENT;

    for (let step = 0; step < stepCount; step += 1) {
      await executeCommand(commandId, "dialog");
    }
  };

  return (
    <SettingsSection title={t("settings.appearance.theme.label")}>
      <SettingRow label={t("settings.appearance.theme.label")}>
        <Select
          onValueChange={(value) =>
            void executeCommand(getThemeCommandId(value as "system" | "light" | "dark"), "dialog")
          }
          value={theme}
        >
          <SelectTrigger aria-label={t("settings.appearance.theme.label")} className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {themeOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.icon}
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <Collapsible>
        <div>
          <SettingRow
            description={t("settings.appearance.primaryColor.description")}
            label={t("settings.appearance.primaryColor.label")}
          >
            <CollapsibleTrigger asChild>
              <Button
                aria-label={t("settings.appearance.primaryColor.label")}
                className="w-44"
                variant="outline"
              >
                <ColorSample color={primaryColor} />
                <span className="font-mono">{primaryColor.toUpperCase()}</span>
                <ChevronsUpDown aria-hidden="true" className="ml-auto text-muted-foreground" />
              </Button>
            </CollapsibleTrigger>
          </SettingRow>

          <CollapsibleContent className="mb-4 flex flex-wrap items-center gap-1.5">
            <ColorPicker
              defaultValue={primaryColor}
              key={colorPickerSession}
              onChange={(color) => {
                if (colorPickerSession === colorPickerSessionRef.current) {
                  previewPrimaryColor(color);
                }
              }}
              onCommit={(color) => {
                if (color !== primaryColor) pickerCommitColor.current = color;
                dispatch(primaryColorChanged(color));
              }}
            >
              <div className="w-full space-y-3">
                <ColorPickerSpectrum aria-label={t("settings.appearance.primaryColor.pickerLabel")}>
                  <ColorPickerSaturationValue
                    aria-label={t("settings.appearance.primaryColor.saturationBrightnessLabel")}
                  />
                  <ColorPickerHue aria-label={t("settings.appearance.primaryColor.hueLabel")} />
                </ColorPickerSpectrum>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ColorPickerInput aria-label={t("settings.appearance.primaryColor.hexLabel")} />
                  </div>

                  {PRIMARY_COLOR_PRESETS.map((preset) => (
                    <ColorPickerPreset key={preset.id} value={preset.color}>
                      <Button
                        aria-label={colorPresetLabels[preset.id]}
                        aria-pressed={primaryColor === preset.color}
                        className="p-0.5"
                        size="icon"
                        variant={primaryColor === preset.color ? "secondary" : "outline"}
                      >
                        <ColorSample color={preset.color} />
                      </Button>
                    </ColorPickerPreset>
                  ))}
                </div>
              </div>
            </ColorPicker>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <SettingRow
        description={t("settings.appearance.scaling.description")}
        label={
          <span className="flex items-center gap-2">
            {t("layout.uiScaling")}
            <CommandButton
              className="h-auto p-0"
              commandId="ui-scale-reset"
              type="reset"
              variant="link"
            >
              {t("common.actions.reset")}
            </CommandButton>
          </span>
        }
      >
        <Select
          onValueChange={(value) => void handleUiScaleChange(value)}
          value={String(uiScalePercent)}
        >
          <SelectTrigger aria-label={t("layout.uiScaling")} className="w-44">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {uiScaleOptions.map((scale) => (
              <SelectItem key={scale} value={String(scale)}>
                {scale}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsAppearance };
