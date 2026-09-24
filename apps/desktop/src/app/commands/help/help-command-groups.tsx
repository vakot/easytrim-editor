import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useCheckForUpdatesCommand } from "./definitions/check-for-updates.command";
import { useOpenChangelogCommand } from "./definitions/open-changelog.command";
import { useOpenProjectPageCommand } from "./definitions/open-project-page.command";
import { useOpenReleasePageCommand } from "./definitions/open-release-page.command";
import { useShowLogsCommand } from "./definitions/show-logs.command";
import { useSupportProjectCommand } from "./definitions/support-project.command";

function useHelpCommandGroups() {
  const { t } = useTranslation();
  const openChangelog = useOpenChangelogCommand();
  const checkForUpdates = useCheckForUpdatesCommand();
  const openProjectPage = useOpenProjectPageCommand();
  const showLogs = useShowLogsCommand();
  const supportProject = useSupportProjectCommand();
  const openReleasePage = useOpenReleasePageCommand();
  return [
    defineApplicationCommandGroup("help", t("app.labels.commandSections.help"), [
      openChangelog,
      checkForUpdates,
      openProjectPage,
      showLogs,
      supportProject,
      openReleasePage,
    ] as const),
  ] as const;
}

export { useHelpCommandGroups };
