import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { usePrimaryColorCommands } from "./definitions/primary-color.commands";
import { useThemeCommands } from "./definitions/theme.commands";

function useAppearanceCommandGroups() {
  const { t } = useTranslation();
  const themes = useThemeCommands();
  const colors = usePrimaryColorCommands();
  return [
    defineApplicationCommandGroup(
      "appearance-theme",
      t("app.labels.commandSections.appearanceTheme"),
      themes,
    ),
    defineApplicationCommandGroup(
      "appearance-color",
      t("app.labels.commandSections.appearanceColor"),
      colors,
    ),
  ] as const;
}

export { useAppearanceCommandGroups };
