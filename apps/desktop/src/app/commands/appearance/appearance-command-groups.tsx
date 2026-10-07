import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { usePrimaryColorCommands } from "./definitions/primary-color.commands";
import { useThemeCommands } from "./definitions/theme.commands";
import { useUiScalingCommands } from "./definitions/ui-scaling.commands";

function useAppearanceCommandGroups() {
  const { t } = useTranslation();
  const themes = useThemeCommands();
  const colors = usePrimaryColorCommands();
  const uiScaling = useUiScalingCommands();
  return [
    defineApplicationCommandGroup(
      "appearance-ui-scaling",
      t("commands.sections.appearanceUiScaling"),
      uiScaling,
    ),
    defineApplicationCommandGroup(
      "appearance-theme",
      t("commands.sections.appearanceTheme"),
      themes,
    ),
    defineApplicationCommandGroup(
      "appearance-color",
      t("commands.sections.appearanceColor"),
      colors,
    ),
  ] as const;
}

export { useAppearanceCommandGroups };
