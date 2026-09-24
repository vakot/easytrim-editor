import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useChangelogDialog } from "@/features/changelog";

function useOpenChangelogCommand() {
  const { t } = useTranslation();
  const { openChangelog } = useChangelogDialog();
  return {
    enabled: true,
    icon: <ScrollText aria-hidden="true" />,
    run: openChangelog,
    id: "open-changelog" as const,
    label: t("support.actions.changelog"),
    searchTerms: commandSearchTerms(`${t("support.actions.changelog")}|what's new|release notes`),
    variant: "default" as const,
  };
}

export { useOpenChangelogCommand };
