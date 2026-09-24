import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { GithubIcon } from "@/components/brand-icons";
import { openExternalUrl } from "@/lib/open-external-url.utils";

function useOpenProjectPageCommand() {
  const { t } = useTranslation();
  return {
    enabled: true,
    icon: <GithubIcon aria-hidden="true" />,
    async run() {
      await openExternalUrl("https://github.com/vakot/easytrim-editor");
    },
    id: "open-project-page" as const,
    label: t("support.actions.projectPage"),
    searchTerms: commandSearchTerms(`${t("support.actions.projectPage")}|github|repository`),
    variant: "default" as const,
  };
}

export { useOpenProjectPageCommand };
