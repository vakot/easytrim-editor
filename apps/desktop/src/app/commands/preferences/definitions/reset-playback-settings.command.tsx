import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  playbackSettingsReset,
  selectLoopPlaybackEnabledDefault,
  selectSegmentPlaybackEnabledDefault,
} from "@/app/store/slices/preferences-slice";

function useResetPlaybackSettingsCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const loopPlaybackEnabledDefault = useAppSelector(selectLoopPlaybackEnabledDefault);
  const segmentPlaybackEnabledDefault = useAppSelector(selectSegmentPlaybackEnabledDefault);
  const label = t("common.actions.resetToDefault");

  return {
    enabled:
      loopPlaybackEnabledDefault !== DEFAULT_PREFERENCES.loopPlaybackEnabledDefault ||
      segmentPlaybackEnabledDefault !== DEFAULT_PREFERENCES.segmentPlaybackEnabledDefault,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["dialog", "menu"] as const,
    run() {
      dispatch(playbackSettingsReset());
    },
    id: "reset-playback-settings" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|playback|settings`),
    variant: "destructive" as const,
  };
}

export { useResetPlaybackSettingsCommand };
