import { List, ListTree, ScanText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  activityFeedViewChanged,
  selectActivityFeedView,
} from "@/app/store/slices/preferences-slice";

function useActivityFeedViewCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selected = useAppSelector(selectActivityFeedView);
  const labels = {
    default: t("settings.options.activityFeedViews.default"),
    compact: t("settings.options.activityFeedViews.compact"),
    branch: t("settings.options.activityFeedViews.branch"),
  };

  return (["default", "compact", "branch"] as const).map((view) => ({
    checked: selected === view,
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
    label: labels[view],
    searchTerms: commandSearchTerms(`${labels[view]}|activity|feed`),
    variant: "default" as const,
  }));
}

export { useActivityFeedViewCommands };
