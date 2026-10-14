import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { usePlaybackIsPlaying } from "@/features/playback";
import { usePreviewTransform } from "@/features/preview";

function useSaveFrameCommand() {
  const { t } = useTranslation();
  const { isAvailable, requestSaveFrame } = usePreviewTransform();
  const isPlaying = usePlaybackIsPlaying();
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
