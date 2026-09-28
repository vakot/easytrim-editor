import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePlayback } from "@/app/hooks/usePlayback";
import { usePreviewTransform } from "@/features/preview";

function useSaveFrameCommand() {
  const { t } = useTranslation();
  const { isAvailable, requestSaveFrame } = usePreviewTransform();
  const { isPlaying } = usePlayback();
  const label = t("preview.actions.saveFrame");

  return {
    enabled: isAvailable && !isPlaying,
    icon: <Download aria-hidden="true" />,
    surfaces: ["menu", "palette"] as const,
    run: requestSaveFrame,
    id: "save-current-frame" as const,
    label,
    searchTerms: commandSearchTerms(
      `${label}|${t("app.options.commandSearchTerms.saveCurrentFrame")}`,
    ),
    variant: "default" as const,
  };
}

export { useSaveFrameCommand };
