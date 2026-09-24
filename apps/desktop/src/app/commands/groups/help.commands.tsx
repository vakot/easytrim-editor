import {
  CheckCircle2,
  CircleAlert,
  Download,
  ExternalLink,
  FolderInput,
  LoaderCircle,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  commandSearchTerms,
  defineApplicationCommandGroup,
} from "@/app/commands/application-command.utils";
import { useAppUpdates } from "@/app/hooks/useAppUpdates";
import { GithubIcon, KofiIcon } from "@/components/brand-icons";
import { useChangelogDialog } from "@/features/changelog";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { openExternalUrl } from "@/lib/open-external-url.utils";
import { revealDiagnosticLogs } from "@/lib/tauri/diagnostics";
import { requestWindowShutdown } from "@/lib/tauri/window";

function useHelpCommandGroup() {
  const { t } = useTranslation();
  const { openChangelog } = useChangelogDialog();
  const {
    availableVersion,
    checkForUpdates,
    installUpdate,
    isInstalling,
    status: updateStatus,
  } = useAppUpdates();
  const section = useMemo(
    () => ({ id: "help", label: t("app.labels.commandSections.help") }),
    [t],
  );
  const updateIcon =
    updateStatus === "checking" || isInstalling ? (
      <LoaderCircle aria-hidden="true" className="animate-spin" />
    ) : availableVersion ? (
      <Download aria-hidden="true" />
    ) : updateStatus === "up-to-date" ? (
      <CheckCircle2 aria-hidden="true" />
    ) : updateStatus === "error" ? (
      <CircleAlert aria-hidden="true" />
    ) : (
      <RefreshCw aria-hidden="true" />
    );

  return useMemo(
    () =>
      defineApplicationCommandGroup("help", [
        {
          enabled: true,
          icon: <ScrollText aria-hidden="true" />,
          run: openChangelog,
          id: "open-changelog",
          label: t("support.actions.changelog"),
          searchTerms: commandSearchTerms(
            `${t("support.actions.changelog")}|what's new|release notes`,
          ),
          section,
          variant: "default",
        },
        {
          enabled: updateStatus !== "checking" && !isInstalling,
          icon: updateIcon,
          async run() {
            if (availableVersion) await requestWindowShutdown(installUpdate);
            else await checkForUpdates();
          },
          id: "check-for-updates",
          label:
            updateStatus === "checking"
              ? t("app.status.checkingForUpdates")
              : availableVersion
                ? t("app.actions.update")
                : updateStatus === "up-to-date"
                  ? t("app.status.upToDate")
                  : t("app.actions.checkForUpdates"),
          searchTerms: commandSearchTerms(`${t("app.actions.checkForUpdates")}|update`),
          section,
          variant:
            updateStatus === "up-to-date"
              ? "success"
              : updateStatus === "error"
                ? "destructive"
                : "default",
        },
        {
          enabled: true,
          icon: <GithubIcon aria-hidden="true" />,
          async run() {
            await openExternalUrl("https://github.com/vakot/easytrim-editor");
          },
          id: "open-project-page",
          label: t("support.actions.projectPage"),
          searchTerms: commandSearchTerms(`${t("support.actions.projectPage")}|github|repository`),
          section,
          variant: "default",
        },
        {
          enabled: true,
          icon: <FolderInput aria-hidden="true" />,
          async run() {
            await revealDiagnosticLogs();
          },
          id: "show-logs",
          label: t("support.actions.showLogs"),
          searchTerms: commandSearchTerms(`${t("support.actions.showLogs")}|diagnostics|logs`),
          section,
          variant: "default",
        },
        {
          enabled: true,
          icon: <KofiIcon aria-hidden="true" />,
          async run() {
            await openExternalUrl("https://ko-fi.com/vakot");
          },
          id: "support-project",
          label: t("support.actions.projectSupport"),
          searchTerms: commandSearchTerms(`${t("support.actions.projectSupport")}|donate|support`),
          section,
          variant: "default",
        },
        {
          enabled: true,
          icon: <ExternalLink aria-hidden="true" />,
          async run() {
            await openExternalUrl(
              `https://github.com/vakot/easytrim-editor/releases/tag/v${getCurrentVersion()}`,
            );
          },
          id: "open-release-page",
          label: t("app.labels.version", { version: getCurrentVersion() }),
          searchTerms: commandSearchTerms(
            `${t("app.labels.version", { version: getCurrentVersion() })}|release|version`,
          ),
          section,
          variant: "default",
        },
      ]),
    [
      availableVersion,
      checkForUpdates,
      installUpdate,
      isInstalling,
      openChangelog,
      section,
      t,
      updateIcon,
      updateStatus,
    ],
  );
}

export { useHelpCommandGroup };
