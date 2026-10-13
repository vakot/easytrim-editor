import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SETTINGS_SHORTCUT } from "@/app/commands/core/application-command.shortcuts";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { AppSettingsDialog } from "@/app/dialogs/AppSettingsDialog";
import { useSettingsDialog } from "@/app/hooks/useAppDialog";
import { preloadOnIntent } from "@/lib/lazy-component";

function useOpenSettingsCommand() {
  const { t } = useTranslation();
  const { openDialog } = useSettingsDialog();
  const label = t("settings.title");

  return {
    enabled: true,
    icon: <Settings aria-hidden="true" />,
    preload: preloadOnIntent(AppSettingsDialog.preload),
    run: openDialog,
    id: "open-settings" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|open|dialog|preferences|configuration`),
    shortcut: SETTINGS_SHORTCUT,
    variant: "default" as const,
  };
}

export { useOpenSettingsCommand };
