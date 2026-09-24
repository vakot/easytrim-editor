import {
  LayoutTemplate,
  List,
  ListTree,
  PanelsLeftBottom,
  PanelBottom,
  PanelLeft,
  RotateCcw,
  ScanText,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  commandSearchTerms,
  defineApplicationCommandGroup,
} from "@/app/commands/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { usePanelCommand } from "@/components/ui/resizable";
import {
  activityFeedViewChanged,
  layoutDensityChanged,
  selectActivityFeedView,
  selectLayoutDensity,
} from "@/app/store/slices/preferences-slice";

function useLayoutCommandGroup() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const leftPanel = usePanelCommand("workspace-sidebar");
  const bottomPanel = usePanelCommand("editor-stage-timeline");
  const layoutPanels = usePanelCommand(["workspace-sidebar", "editor-stage-timeline"]);
  const panelsSection = useMemo(
    () => ({ id: "layout-panels-visibility", label: t("app.labels.commandSections.layoutPanelsVisibility") }),
    [t],
  );
  const densitySection = useMemo(
    () => ({ id: "layout-density", label: t("app.labels.commandSections.layoutDensity") }),
    [t],
  );
  const activitySection = useMemo(
    () => ({ id: "layout-activity-feed-view", label: t("app.labels.commandSections.layoutActivityFeedView") }),
    [t],
  );
  const layoutSection = useMemo(
    () => ({ id: "layout", label: t("app.labels.commandSections.layout") }),
    [t],
  );
  const densityLabels = useMemo(
    () => ({
      compact: t("app.options.layoutDensities.compact"),
      default: t("app.options.layoutDensities.default"),
    }),
    [t],
  );
  const activityLabels = useMemo(
    () => ({
      branch: t("settings.options.activityFeedViews.branch"),
      compact: t("settings.options.activityFeedViews.compact"),
      default: t("settings.options.activityFeedViews.default"),
    }),
    [t],
  );

  return useMemo(
    () =>
      defineApplicationCommandGroup("layout", [
        {
          checked: !leftPanel.isCollapsed,
          enabled: leftPanel.isAvailable,
          icon: <PanelLeft aria-hidden="true" />,
          run: leftPanel.toggle,
          id: "toggle-left-panel",
          label: t("app.actions.showPanel", { panel: t("app.labels.leftPanel") }),
          searchTerms: commandSearchTerms(`${t("app.labels.leftPanel")}|panel|sidebar`),
          section: panelsSection,
          variant: "default",
        },
        {
          checked: !bottomPanel.isCollapsed,
          enabled: bottomPanel.isAvailable,
          icon: <PanelBottom aria-hidden="true" />,
          run: bottomPanel.toggle,
          id: "toggle-bottom-panel",
          label: t("app.actions.showPanel", { panel: t("app.labels.bottomPanel") }),
          searchTerms: commandSearchTerms(`${t("app.labels.bottomPanel")}|panel|timeline`),
          section: panelsSection,
          variant: "default",
        },
        ...(["default", "compact"] as const).map((density) => ({
          checked: layoutDensity === density,
          enabled: true,
          icon:
            density === "default" ? (
              <LayoutTemplate aria-hidden="true" className="-scale-x-100 -rotate-90" />
            ) : (
              <PanelsLeftBottom aria-hidden="true" />
            ),
          run() {
            dispatch(layoutDensityChanged(density));
          },
          id: `layout-density-${density}` as const,
          label: densityLabels[density],
          searchTerms: commandSearchTerms(`${densityLabels[density]}|layout|density`),
          section: densitySection,
          variant: "default" as const,
        })),
        ...(["default", "compact", "branch"] as const).map((view) => ({
          checked: activityFeedView === view,
          enabled: true,
          icon:
            view === "default" ? (
              <List aria-hidden="true" />
            ) : view === "compact" ? (
              <ScanText aria-hidden="true" />
            ) : (
              <ListTree aria-hidden="true" />
            ),
          run() {
            dispatch(activityFeedViewChanged(view));
          },
          id: `activity-feed-view-${view}` as const,
          label: activityLabels[view],
          searchTerms: commandSearchTerms(`${activityLabels[view]}|activity|feed`),
          section: activitySection,
          variant: "default" as const,
        })),
        {
          enabled: layoutPanels.isAvailable && !layoutPanels.isReset,
          icon: <RotateCcw aria-hidden="true" />,
          run: layoutPanels.reset,
          id: "reset-layout",
          label: t("app.actions.resetLayout"),
          searchTerms: commandSearchTerms(`${t("app.actions.resetLayout")}|layout|panels`),
          section: layoutSection,
          variant: "destructive",
        },
      ]),
    [
      activityFeedView,
      activityLabels,
      activitySection,
      bottomPanel,
      densityLabels,
      densitySection,
      dispatch,
      layoutDensity,
      layoutPanels,
      leftPanel,
      panelsSection,
      t,
      layoutSection,
    ],
  );
}

export { useLayoutCommandGroup };
