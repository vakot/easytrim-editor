import { ChartNoAxesCombined } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { AppStatisticsDialog } from "@/app/dialogs/AppStatisticsDialog";
import { useStatisticsDialog } from "@/app/hooks/useAppDialog";
import { preloadOnIntent } from "@/lib/lazy-component";

function useOpenStatisticsCommand() {
  const { t } = useTranslation();
  const { openDialog } = useStatisticsDialog();
  const label = t("statistics.open");

  return {
    enabled: true,
    icon: <ChartNoAxesCombined aria-hidden="true" />,
    preload: preloadOnIntent(AppStatisticsDialog.preload),
    run: openDialog,
    id: "open-statistics" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|open|dialog|usage|exports|dashboard|stats`),
    variant: "default" as const,
  };
}

export { useOpenStatisticsCommand };
