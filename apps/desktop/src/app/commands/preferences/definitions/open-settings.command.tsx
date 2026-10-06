import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";

function useOpenSettingsCommand() {
  const { t } = useTranslation();
  const { openSettings } = useSettingsDialog();
  const label = t("settings.labels.title");

  return {
    enabled: true,
    icon: <Settings aria-hidden="true" />,
    run: openSettings,
    id: "open-settings" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|preferences|configuration`),
    variant: "default" as const,
  };
}

export { useOpenSettingsCommand };
