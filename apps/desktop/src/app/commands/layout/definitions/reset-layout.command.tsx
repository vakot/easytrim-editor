import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePanelCommand } from "@/components/ui/resizable";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_SIDEBAR_LAYOUT } from "@/app/layout/lib/sidebar-layout";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  layoutReset,
  selectActivityFeedView,
  selectLayoutDensity,
  selectSidebarLayout,
} from "@/app/store/slices/preferences-slice";

function useResetLayoutCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const sidebarLayout = useAppSelector(selectSidebarLayout);
  const leftSidebarPanel = usePanelCommand("workspace-sidebar");
  const rightSidebarPanel = usePanelCommand("workspace-right-sidebar");
  const timelinePanel = usePanelCommand("editor-stage-timeline");
  const sourceViewsPanel = usePanelCommand([
    "editor-source-imported-sources",
    "editor-source-activity-feed",
  ]);

  const panelCommands = [leftSidebarPanel, rightSidebarPanel, timelinePanel, sourceViewsPanel];

  const label = t("common.actions.resetToDefault");
  const hasLayoutPreferencesToReset =
    activityFeedView !== DEFAULT_PREFERENCES.activityFeedView ||
    layoutDensity !== DEFAULT_PREFERENCES.layoutDensity ||
    sidebarLayout.left.length !== DEFAULT_SIDEBAR_LAYOUT.left.length ||
    sidebarLayout.left.some((viewId, index) => viewId !== DEFAULT_SIDEBAR_LAYOUT.left[index]) ||
    sidebarLayout.right.length !== DEFAULT_SIDEBAR_LAYOUT.right.length;

  return {
    enabled:
      hasLayoutPreferencesToReset ||
      panelCommands.some((panel) => panel.isAvailable && !panel.isReset),
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["dialog", "menu"] as const,
    run() {
      dispatch(layoutReset());
      panelCommands.forEach((panel) => {
        if (panel.isAvailable) panel.reset();
      });
    },
    id: "reset-layout" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|layout|panels`),
    variant: "destructive" as const,
  };
}

export { useResetLayoutCommand };
