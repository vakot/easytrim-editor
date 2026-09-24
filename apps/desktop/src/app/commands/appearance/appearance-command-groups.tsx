import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { usePrimaryColorCommands } from "./definitions/primary-color.commands";
import { useResetViewSettingsCommand } from "./definitions/reset-view-settings.command";
import { useThemeCommands } from "./definitions/theme.commands";

function useAppearanceCommandGroups() {
  const { t } = useTranslation();
  const themes = useThemeCommands();
  const colors = usePrimaryColorCommands();
  const resetViewSettings = useResetViewSettingsCommand();
  return [
    defineApplicationCommandGroup(
      "appearance-theme",
      t("app.labels.commandSections.appearanceTheme"),
      [...themes, resetViewSettings] as const,
    ),
    defineApplicationCommandGroup(
      "appearance-color",
      t("app.labels.commandSections.appearanceColor"),
      colors,
    ),
  ] as const;
}

export { useAppearanceCommandGroups };
