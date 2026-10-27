import { useTranslation } from "react-i18next";

import { KofiIcon } from "@easytrim-editor/ui/brand-icons";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { openExternalUrl } from "@/lib/open-external-url.utils";

function useSupportProjectCommand() {
  const { t } = useTranslation();
  return {
    enabled: true,
    icon: <KofiIcon aria-hidden="true" />,
    async run() {
      await openExternalUrl("https://ko-fi.com/vakot");
    },
    id: "support-project" as const,
    label: t("support.project.actions.projectSupport"),
    searchTerms: commandSearchTerms(
      `${t("support.project.actions.projectSupport")}|donate|support`,
    ),
    variant: "default" as const,
  };
}

export { useSupportProjectCommand };
