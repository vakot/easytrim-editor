import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { openExternalUrl } from "@/lib/open-external-url.utils";

function useOpenReleasePageCommand() {
  const { t } = useTranslation();
  const versionLabel = t("app.labels.version", { version: getCurrentVersion() });
  return {
    enabled: true,
    icon: <ExternalLink aria-hidden="true" />,
    async run() {
      await openExternalUrl(
        `https://github.com/vakot/easytrim-editor/releases/tag/v${getCurrentVersion()}`,
      );
    },
    id: "open-release-page" as const,
    label: versionLabel,
    searchTerms: commandSearchTerms(`${versionLabel}|release|version`),
    variant: "default" as const,
  };
}

export { useOpenReleasePageCommand };
