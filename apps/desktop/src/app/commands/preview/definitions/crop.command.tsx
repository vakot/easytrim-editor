import { Crop } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePreviewTransform } from "@/features/preview";

function useCropPreviewCommand() {
  const { t } = useTranslation();
  const { isAvailable, requestCrop } = usePreviewTransform();
  const label = t("preview.actions.transform.crop");
  return {
    enabled: isAvailable,
    icon: <Crop aria-hidden="true" />,
    run: requestCrop,
    id: "crop-preview" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|crop|transform`),
    variant: "default" as const,
  };
}

export { useCropPreviewCommand };
