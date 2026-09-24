import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useActivityFeedViewCommands } from "./definitions/activity-feed-view.commands";
import { useLayoutDensityCommands } from "./definitions/layout-density.commands";
import { usePanelCommands } from "./definitions/panels.commands";
import { useResetLayoutCommand } from "./definitions/reset-layout.command";

function useLayoutCommandGroups() {
  const { t } = useTranslation();
  const panels = usePanelCommands();
  const densities = useLayoutDensityCommands();
  const feedViews = useActivityFeedViewCommands();
  const reset = useResetLayoutCommand();
  return [
    defineApplicationCommandGroup(
      "layout-panels-visibility",
      t("app.labels.commandSections.layoutPanelsVisibility"),
      panels,
    ),
    defineApplicationCommandGroup(
      "layout-density",
      t("app.labels.commandSections.layoutDensity"),
      densities,
    ),
    defineApplicationCommandGroup(
      "layout-activity-feed-view",
      t("app.labels.commandSections.layoutActivityFeedView"),
      feedViews,
    ),
    defineApplicationCommandGroup("layout", t("app.labels.commandSections.layout"), [reset]),
  ] as const;
}

export { useLayoutCommandGroups };
