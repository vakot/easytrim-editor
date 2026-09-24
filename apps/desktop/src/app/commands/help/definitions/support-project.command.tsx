import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { KofiIcon } from "@/components/brand-icons";
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
    label: t("support.actions.projectSupport"),
    searchTerms: commandSearchTerms(`${t("support.actions.projectSupport")}|donate|support`),
    variant: "default" as const,
  };
}

export { useSupportProjectCommand };
