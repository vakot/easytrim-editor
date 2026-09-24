import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePanelCommand } from "@/components/ui/resizable";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  layoutReset,
  selectActivityFeedView,
  selectLayoutDensity,
} from "@/app/store/slices/preferences-slice";

function useResetLayoutCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const layoutDensity = useAppSelector(selectLayoutDensity);
  const panels = usePanelCommand(["workspace-sidebar", "editor-stage-timeline"]);
  const label = t("app.actions.resetLayout");
  const hasLayoutPreferencesToReset =
    activityFeedView !== DEFAULT_PREFERENCES.activityFeedView ||
    layoutDensity !== DEFAULT_PREFERENCES.layoutDensity;

  return {
    enabled: hasLayoutPreferencesToReset || (panels.isAvailable && !panels.isReset),
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["menu"] as const,
    run() {
      dispatch(layoutReset());
      panels.reset();
    },
    id: "reset-layout" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|layout|panels`),
    variant: "destructive" as const,
  };
}

export { useResetLayoutCommand };
