import { PanelBottom, PanelLeft, PanelRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePanelCommand } from "@/components/ui/resizable";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSidebarLayout } from "@/app/store/slices/preferences-slice";
import { selectHasAudio } from "@/app/store/slices/source-slice";

function usePanelCommands() {
  const { t } = useTranslation();
  const hasAudio = useAppSelector(selectHasAudio);
  const sidebarLayout = useAppSelector(selectSidebarLayout);
  const hasLeftSidebar = sidebarLayout.left.length > 0;
  const hasRightSidebar = sidebarLayout.right.length > 0;
  const left = usePanelCommand("workspace-left-sidebar");
  const right = usePanelCommand("workspace-right-sidebar");
  const bottom = usePanelCommand("editor-stage-timeline");
  return [
    {
      checked: hasLeftSidebar && !left.isCollapsed,
      enabled: left.isAvailable && hasLeftSidebar,
      icon: <PanelLeft aria-hidden="true" />,
      run: () => {
        if (hasLeftSidebar) left.toggle();
      },
      id: "toggle-left-panel" as const,
      label: t("layout.showLeftPanel"),
      searchTerms: commandSearchTerms(t("layout.showLeftPanel")),
      variant: "default" as const,
    },
    {
      checked: hasRightSidebar && !right.isCollapsed,
      enabled: right.isAvailable && hasRightSidebar,
      icon: <PanelRight aria-hidden="true" />,
      run: () => {
        if (hasRightSidebar) right.toggle();
      },
      id: "toggle-right-panel" as const,
      label: t("layout.showRightPanel"),
      searchTerms: commandSearchTerms(t("layout.showRightPanel")),
      variant: "default" as const,
    },
    {
      checked: hasAudio && !bottom.isCollapsed,
      enabled: bottom.isAvailable && hasAudio,
      icon: <PanelBottom aria-hidden="true" />,
      run: bottom.toggle,
      id: "toggle-bottom-panel" as const,
      label: t("layout.showBottomPanel"),
      searchTerms: commandSearchTerms(t("layout.showBottomPanel")),
      variant: "default" as const,
    },
  ] as const;
}

export { usePanelCommands };
