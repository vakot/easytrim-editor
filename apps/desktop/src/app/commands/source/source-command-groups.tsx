import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useSourceNavigationCommands } from "./definitions/navigation.commands";

function useSourceCommandGroups() {
  const { t } = useTranslation();
  const [previous, next] = useSourceNavigationCommands();

  return [
    defineApplicationCommandGroup("source-navigation", t("app.labels.commandSections.go"), [
      previous,
      next,
    ] as const),
  ] as const;
}

export { useSourceCommandGroups };
