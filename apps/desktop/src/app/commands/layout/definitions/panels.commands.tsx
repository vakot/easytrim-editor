import { PanelBottom, PanelLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePanelCommand } from "@/components/ui/resizable";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";

function usePanelCommands() {
  const { t } = useTranslation();
  const left = usePanelCommand("workspace-sidebar");
  const bottom = usePanelCommand("editor-stage-timeline");
  return [
    {
      checked: !left.isCollapsed,
      enabled: left.isAvailable,
      icon: <PanelLeft aria-hidden="true" />,
      run: left.toggle,
      id: "toggle-left-panel" as const,
      label: t("layout.showLeftPanel"),
      searchTerms: commandSearchTerms(t("layout.showLeftPanel")),
      variant: "default" as const,
    },
    {
      checked: !bottom.isCollapsed,
      enabled: bottom.isAvailable,
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
