import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { usePrimaryColorCommands } from "./definitions/primary-color.commands";
import { useResetAppearanceSettingsCommand } from "./definitions/reset-appearance-settings.command";
import { useResetAppearanceThemeColorSettingsCommand } from "./definitions/reset-appearance-theme-color-settings.command";
import { useThemeCommands } from "./definitions/theme.commands";
import { useUiScalingCommands } from "./definitions/ui-scaling.commands";

function useAppearanceCommandGroups() {
  const { t } = useTranslation();
  const themes = useThemeCommands();
  const colors = usePrimaryColorCommands();
  const resetViewSettings = useResetAppearanceThemeColorSettingsCommand();
  const resetAppearanceSettings = useResetAppearanceSettingsCommand();
  const uiScaling = useUiScalingCommands();
  return [
    defineApplicationCommandGroup(
      "appearance-ui-scaling",
      t("app.labels.commandSections.appearanceUiScaling"),
      uiScaling,
    ),
    defineApplicationCommandGroup(
      "appearance-theme",
      t("app.labels.commandSections.appearanceTheme"),
      [...themes, resetViewSettings, resetAppearanceSettings] as const,
    ),
    defineApplicationCommandGroup(
      "appearance-color",
      t("app.labels.commandSections.appearanceColor"),
      colors,
    ),
  ] as const;
}

export { useAppearanceCommandGroups };
