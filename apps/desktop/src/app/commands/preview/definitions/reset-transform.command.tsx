import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePreviewTransform } from "@/features/preview";

function useResetTransformCommand() {
  const { t } = useTranslation();
  const { isAvailable, requestReset } = usePreviewTransform();
  const label = t("preview.actions.transform.reset");
  return {
    enabled: isAvailable,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["menu"] as const,
    run: requestReset,
    id: "reset-transform" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|reset|transform`),
    variant: "destructive" as const,
  };
}

export { useResetTransformCommand };
