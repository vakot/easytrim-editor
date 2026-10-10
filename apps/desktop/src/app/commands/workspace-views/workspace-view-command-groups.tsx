import { Activity, Files, List } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  commandSearchTerms,
  defineApplicationCommandGroup,
} from "@/app/commands/core/application-command.utils";
import { useWorkspaceViews } from "@/app/contexts/workspace-views-context";
import type { SidebarId, SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { getSidebarViewSide, WORKSPACE_VIEWS } from "@/app/layout/lib/workspace-view-registry";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectSidebarLayout,
  sidebarLayoutChanged,
  sidebarViewRemoved,
} from "@/app/store/slices/preferences-slice";

const viewIcons = {
  activity: <Activity aria-hidden="true" />,
  exportQueue: <List aria-hidden="true" />,
  sources: <Files aria-hidden="true" />,
} satisfies Record<SidebarViewId, React.ReactNode>;

function useWorkspaceViewCommandGroups() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { openView, requestDockPlacement } = useWorkspaceViews();
  const layout = useAppSelector(selectSidebarLayout);

  const openCommands = WORKSPACE_VIEWS.map((view) => {
    const label =
      view.id === "sources"
        ? t("source.importedSources")
        : view.id === "activity"
          ? t("layout.activityFeed")
          : t("queue.title");

    return {
      enabled: true,
      icon: viewIcons[view.id],
      id: `open-workspace-view-${view.id}` as const,
      label,
      searchTerms: commandSearchTerms(`${label}|open|view|workspace`),
      surfaces: ["menu"] as const,
      run() {
        openView(view.id);
      },
      variant: "default" as const,
    };
  });

  const dockCommands = WORKSPACE_VIEWS.flatMap((view) =>
    ([undefined, "left", "right"] as const).map((contextSide) => {
      const side = getSidebarViewSide(layout, view.id);
      const label =
        view.id === "sources"
          ? t("source.importedSources")
          : view.id === "activity"
            ? t("layout.activityFeed")
            : t("queue.title");

      return {
        checked: side !== null,
        enabled: true,
        hint: side
          ? side === "left"
            ? t("layout.leftSidebar")
            : t("layout.rightSidebar")
          : undefined,
        icon: viewIcons[view.id],
        id: contextSide
          ? (`dock-workspace-view-${view.id}-${contextSide}` as const)
          : (`dock-workspace-view-${view.id}` as const),
        label,
        searchTerms: commandSearchTerms(`${label}|dock|sidebar|workspace`),
        surfaces: ["menu"] as const,
        run() {
          if (side) {
            dispatch(sidebarViewRemoved(view.id));
          } else if (contextSide) {
            dispatch(
              sidebarLayoutChanged({
                destination: contextSide as SidebarId,
                insertionIndex: layout[contextSide].length,
                viewId: view.id,
              }),
            );
          } else {
            requestDockPlacement(view.id);
          }
        },
        variant: "default" as const,
      };
    }),
  );

  return [
    defineApplicationCommandGroup("workspace-view-open", t("layout.openView"), openCommands),
    defineApplicationCommandGroup("workspace-view-docks", t("layout.docks"), dockCommands),
  ] as const;
}

export { useWorkspaceViewCommandGroups };
