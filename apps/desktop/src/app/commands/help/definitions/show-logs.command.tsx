import { FolderInput } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { revealDiagnosticLogs } from "@/lib/tauri/diagnostics";

function useShowLogsCommand() {
  const { t } = useTranslation();
  return {
    enabled: true,
    icon: <FolderInput aria-hidden="true" />,
    async run() {
      await revealDiagnosticLogs();
    },
    id: "show-logs" as const,
    label: t("support.actions.showLogs"),
    searchTerms: commandSearchTerms(`${t("support.actions.showLogs")}|diagnostics|logs`),
    variant: "default" as const,
  };
}

export { useShowLogsCommand };
