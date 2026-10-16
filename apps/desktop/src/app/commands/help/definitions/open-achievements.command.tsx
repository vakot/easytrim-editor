import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { AppAchievementsDialog } from "@/app/dialogs/AppAchievementsDialog";
import { useAchievementsDialog } from "@/app/hooks/useAppDialog";
import { preloadOnIntent } from "@/lib/lazy-component";

function useOpenAchievementsCommand() {
  const { t } = useTranslation();
  const { openDialog } = useAchievementsDialog();
  const label = t("achievements.open");

  return {
    enabled: true,
    icon: <Trophy aria-hidden="true" />,
    preload: preloadOnIntent(AppAchievementsDialog.preload),
    run: openDialog,
    id: "open-achievements" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|open|dialog|milestones|trophies|progress|unlocked`),
    variant: "default" as const,
  };
}

export { useOpenAchievementsCommand };
