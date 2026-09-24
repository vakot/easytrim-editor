import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePanelCommand } from "@/components/ui/resizable";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";

function useResetLayoutCommand() {
  const { t } = useTranslation();
  const panels = usePanelCommand(["workspace-sidebar", "editor-stage-timeline"]);
  const label = t("app.actions.resetLayout");
  return {
    enabled: panels.isAvailable && !panels.isReset,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["menu"] as const,
    run: panels.reset,
    id: "reset-layout" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|layout|panels`),
    variant: "destructive" as const,
  };
}

export { useResetLayoutCommand };
