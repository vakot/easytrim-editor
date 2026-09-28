import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePreviewTransform } from "@/features/preview";

function useCopyFrameCommand() {
  const { t } = useTranslation();
  const { isAvailable, requestCopyFrame } = usePreviewTransform();
  const label = t("preview.actions.copyFrame");

  return {
    enabled: isAvailable,
    icon: <Copy aria-hidden="true" />,
    surfaces: ["menu", "palette"] as const,
    run: requestCopyFrame,
    id: "copy-current-frame" as const,
    label,
    searchTerms: commandSearchTerms(
      `${label}|${t("app.options.commandSearchTerms.copyCurrentFrame")}`,
    ),
    variant: "default" as const,
  };
}

export { useCopyFrameCommand };
