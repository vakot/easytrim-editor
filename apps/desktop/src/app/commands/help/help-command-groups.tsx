import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useCheckForUpdatesCommand } from "./definitions/check-for-updates.command";
import { useOpenAchievementsCommand } from "./definitions/open-achievements.command";
import { useOpenChangelogCommand } from "./definitions/open-changelog.command";
import { useOpenProjectPageCommand } from "./definitions/open-project-page.command";
import { useOpenReleasePageCommand } from "./definitions/open-release-page.command";
import { useOpenStatisticsCommand } from "./definitions/open-statistics.command";
import { useShowLogsCommand } from "./definitions/show-logs.command";
import { useSupportProjectCommand } from "./definitions/support-project.command";

function useHelpCommandGroups() {
  const { t } = useTranslation();
  const openChangelog = useOpenChangelogCommand();
  const openStatistics = useOpenStatisticsCommand();
  const openAchievements = useOpenAchievementsCommand();
  const checkForUpdates = useCheckForUpdatesCommand();
  const openProjectPage = useOpenProjectPageCommand();
  const showLogs = useShowLogsCommand();
  const supportProject = useSupportProjectCommand();
  const openReleasePage = useOpenReleasePageCommand();
  return [
    defineApplicationCommandGroup("help", t("commands.sections.help"), [
      openChangelog,
      openStatistics,
      openAchievements,
      checkForUpdates,
      openProjectPage,
      showLogs,
      supportProject,
      openReleasePage,
    ] as const),
  ] as const;
}

export { useHelpCommandGroups };
