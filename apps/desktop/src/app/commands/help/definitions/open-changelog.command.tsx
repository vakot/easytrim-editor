import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useChangelogDialog } from "@/features/changelog";

function useOpenChangelogCommand() {
  const { t } = useTranslation();
  const { openChangelog, preloadChangelog } = useChangelogDialog();
  return {
    enabled: true,
    icon: <ScrollText aria-hidden="true" />,
    preload: preloadChangelog,
    run: openChangelog,
    id: "open-changelog" as const,
    label: t("support.changelog.open"),
    searchTerms: commandSearchTerms(
      `${t("support.changelog.open")}|open|dialog|what's new|release notes`,
    ),
    variant: "default" as const,
  };
}

export { useOpenChangelogCommand };
