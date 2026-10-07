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
      t("commands.sections.layoutPanelsVisibility"),
      panels,
    ),
    defineApplicationCommandGroup(
      "layout-density",
      t("commands.sections.layoutDensity"),
      densities,
    ),
    defineApplicationCommandGroup(
      "layout-activity-feed-view",
      t("commands.sections.layoutActivityFeedView"),
      feedViews,
    ),
    defineApplicationCommandGroup("layout", t("commands.sections.layout"), [reset]),
  ] as const;
}

export { useLayoutCommandGroups };
