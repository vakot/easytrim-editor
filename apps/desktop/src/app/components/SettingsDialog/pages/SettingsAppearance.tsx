import { Monitor, Moon, Sun } from "lucide-react";
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

import { getPrimaryColorCommandId, getThemeCommandId } from "@/app/commands/appearance";
import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectCustomPrimaryColor,
  selectPrimaryColor,
  selectThemePreference,
} from "@/app/store/slices/preferences-slice";
import { PRIMARY_COLORS, resolvePrimaryColor } from "@/app/theme/theme";

import {
  CustomColorInput,
  CustomColorPopover,
  CustomColorPopoverContent,
  CustomColorPopoverTrigger,
} from "../components/CustomColorPopover";
import { CommandButton, CommandReset, SettingRow, SettingsSection } from "../components/SettingRow";

function SettingsAppearance() {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const theme = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const customPrimaryColor = useAppSelector(selectCustomPrimaryColor);
  const colorLabels = {
    amber: t("settings.options.colors.amber"),
    blue: t("settings.options.colors.blue"),
    emerald: t("settings.options.colors.emerald"),
    rose: t("settings.options.colors.rose"),
    violet: t("settings.options.colors.violet"),
  };

  const themeOptions = [
    {
      id: "system",
      icon: <Monitor aria-hidden="true" />,
      label: t("settings.options.themes.system"),
    },
    { id: "light", icon: <Sun aria-hidden="true" />, label: t("settings.options.themes.light") },
    { id: "dark", icon: <Moon aria-hidden="true" />, label: t("settings.options.themes.dark") },
  ] as const;

  return (
    <SettingsSection title={t("settings.labels.theme")}>
      <SettingRow label={t("settings.labels.theme")}>
        <Select
          onValueChange={(value) =>
            void executeCommand(getThemeCommandId(value as "system" | "light" | "dark"), "dialog")
          }
          value={theme}
        >
          <SelectTrigger aria-label={t("settings.labels.theme")} className="w-44">
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
            description={t("settings.pages.appearance.colorDescription")}
            label={t("settings.labels.primaryAccent")}
          >
            <CollapsibleTrigger>
              <Button className="size-8 p-0" style={{ backgroundColor: primaryColor }} />
            </CollapsibleTrigger>
          </SettingRow>

          <CollapsibleContent className="mb-4 flex flex-wrap items-center gap-1.5">
            {PRIMARY_COLORS.map((color) => (
              <Button
                aria-label={colorLabels[color]}
                aria-pressed={primaryColor === color}
                className="size-8 p-0"
                key={color}
                onClick={() => void executeCommand(getPrimaryColorCommandId(color), "dialog")}
                style={{ backgroundColor: resolvePrimaryColor(color) }}
                title={colorLabels[color]}
              />
            ))}

            <CustomColorPopover value={customPrimaryColor}>
              <CustomColorPopoverTrigger asChild>
                <Button style={{ backgroundColor: resolvePrimaryColor(customPrimaryColor) }}>
                  {t("settings.options.colors.custom")}
                </Button>
              </CustomColorPopoverTrigger>

              <CustomColorPopoverContent>
                <div className="flex h-6 items-center rounded-lg border px-1.5">
                  <span className="font-mono text-xs text-muted-foreground">#</span>
                  <CustomColorInput aria-label={t("settings.accessibility.customColorHex")} />
                </div>
              </CustomColorPopoverContent>
            </CustomColorPopover>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <SettingRow
        description={t("settings.pages.appearance.scalingDescription")}
        label={
          <span className="flex items-center">
            {t("app.labels.uiScaling")}
            <CommandButton commandId="ui-scale-reset" type="reset" variant="link">
              {t("common.actions.reset")}
            </CommandButton>
          </span>
        }
      >
        <Select defaultValue="100">
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="100">100%</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label={t("settings.pages.appearance.resetLabel")}>
        <CommandReset commandId="reset-view-settings" />
      </SettingRow>
    </SettingsSection>
  );
}

export { SettingsAppearance };
