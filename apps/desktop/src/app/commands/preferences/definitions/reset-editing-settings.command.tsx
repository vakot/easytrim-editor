import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  editingSettingsReset,
  selectLoopPlaybackEnabledDefault,
  selectMergeAudioEnabledDefault,
  selectSegmentPlaybackEnabledDefault,
} from "@/app/store/slices/preferences-slice";

function useResetEditingSettingsCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const loopPlaybackEnabledDefault = useAppSelector(selectLoopPlaybackEnabledDefault);
  const segmentPlaybackEnabledDefault = useAppSelector(selectSegmentPlaybackEnabledDefault);
  const mergeAudioEnabledDefault = useAppSelector(selectMergeAudioEnabledDefault);
  const label = t("common.actions.resetToDefault");

  return {
    enabled:
      loopPlaybackEnabledDefault !== DEFAULT_PREFERENCES.loopPlaybackEnabledDefault ||
      segmentPlaybackEnabledDefault !== DEFAULT_PREFERENCES.segmentPlaybackEnabledDefault ||
      mergeAudioEnabledDefault !== DEFAULT_PREFERENCES.mergeAudioEnabledDefault,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["dialog", "menu"] as const,
    run() {
      dispatch(editingSettingsReset());
    },
    id: "reset-editing-settings" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|editing|settings`),
    variant: "destructive" as const,
  };
}

export { useResetEditingSettingsCommand };
