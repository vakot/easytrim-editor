import { CheckCircle2, CircleAlert, Download, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/ui/spinner";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { requestWindowShutdown } from "@/lib/tauri/window";

function useCheckForUpdatesCommand() {
  const { t } = useTranslation();
  const { availableVersion, checkForUpdates, installUpdate, isInstalling, status } =
    useAppUpdates();

  const icon = useMemo(() => {
    if (status === "checking" || isInstalling) return <Spinner aria-hidden="true" />;
    if (availableVersion) return <Download aria-hidden="true" />;
    if (status === "up-to-date") return <CheckCircle2 aria-hidden="true" />;
    if (status === "error") return <CircleAlert aria-hidden="true" />;
    return <RefreshCw aria-hidden="true" />;
  }, [availableVersion, isInstalling, status]);

  return {
    keepOpen: true,
    enabled: status !== "checking" && !isInstalling,
    icon,
    async run() {
      if (availableVersion) await requestWindowShutdown(installUpdate);
      else await checkForUpdates();
    },
    id: "check-for-updates" as const,
    label:
      status === "checking"
        ? t("updates.checkingForUpdates")
        : availableVersion
          ? t("updates.install")
          : status === "up-to-date"
            ? t("updates.upToDate")
            : t("updates.check"),
    searchTerms: commandSearchTerms(`${t("updates.check")}|update`),
    variant:
      status === "up-to-date"
        ? ("success" as const)
        : status === "error"
          ? ("destructive" as const)
          : ("default" as const),
  };
}

export { useCheckForUpdatesCommand };
