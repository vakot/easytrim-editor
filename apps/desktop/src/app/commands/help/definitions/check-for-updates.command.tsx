import { CheckCircle2, CircleAlert, Download, LoaderCircle, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { requestWindowShutdown } from "@/lib/tauri/window";

function useCheckForUpdatesCommand() {
  const { t } = useTranslation();
  const { availableVersion, checkForUpdates, installUpdate, isInstalling, status } =
    useAppUpdates();

  const icon = useMemo(() => {
    if (status === "checking" || isInstalling)
      return <LoaderCircle aria-hidden="true" className="animate-spin" />;
    if (availableVersion) return <Download aria-hidden="true" />;
    if (status === "up-to-date") return <CheckCircle2 aria-hidden="true" />;
    if (status === "error") return <CircleAlert aria-hidden="true" />;
    return <RefreshCw aria-hidden="true" />;
  }, [availableVersion, isInstalling, status]);

  return {
    enabled: status !== "checking" && !isInstalling,
    icon,
    async run() {
      if (availableVersion) await requestWindowShutdown(installUpdate);
      else await checkForUpdates();
    },
    id: "check-for-updates" as const,
    label:
      status === "checking"
        ? t("app.status.checkingForUpdates")
        : availableVersion
          ? t("app.actions.update")
          : status === "up-to-date"
            ? t("app.status.upToDate")
            : t("app.actions.checkForUpdates"),
    searchTerms: commandSearchTerms(`${t("app.actions.checkForUpdates")}|update`),
    variant:
      status === "up-to-date"
        ? ("success" as const)
        : status === "error"
          ? ("destructive" as const)
          : ("default" as const),
  };
}

export { useCheckForUpdatesCommand };
