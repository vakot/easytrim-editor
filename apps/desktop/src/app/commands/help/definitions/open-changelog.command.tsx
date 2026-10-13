import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { AppChangelogDialog } from "@/app/dialogs/AppChangelogDialog";
import { useChangelogDialog } from "@/app/hooks/useAppDialog";
import { preloadOnIntent } from "@/lib/lazy-component";

function useOpenChangelogCommand() {
  const { t } = useTranslation();
  const { openDialog } = useChangelogDialog();
  return {
    enabled: true,
    icon: <ScrollText aria-hidden="true" />,
    preload: preloadOnIntent(AppChangelogDialog.preload),
    run: openDialog,
    id: "open-changelog" as const,
    label: t("support.changelog.open"),
    searchTerms: commandSearchTerms(
      `${t("support.changelog.open")}|open|dialog|what's new|release notes`,
    ),
    variant: "default" as const,
  };
}

export { useOpenChangelogCommand };
