import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePreviewTransform } from "@/features/preview";
import { useTimelineTransport } from "@/features/timeline";

function useSaveFrameCommand() {
  const { t } = useTranslation();
  const { isAvailable, requestSaveFrame } = usePreviewTransform();
  const { isPlaying } = useTimelineTransport();
  const label = t("preview.frame.saveFrame");

  return {
    enabled: isAvailable && !isPlaying,
    icon: <Download aria-hidden="true" />,
    surfaces: ["menu", "palette"] as const,
    run: requestSaveFrame,
    id: "save-current-frame" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|${t("commands.searchTerms.saveCurrentFrame")}`),
    variant: "default" as const,
  };
}

export { useSaveFrameCommand };
