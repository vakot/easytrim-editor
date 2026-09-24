import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { preferencesReset, selectPreferences } from "@/app/store/slices/preferences-slice";

function useResetPreferencesCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const label = t("app.actions.resetToDefault");

  return {
    enabled:
      preferences.autoStartQueueEnabled !== DEFAULT_PREFERENCES.autoStartQueueEnabled ||
      preferences.loopPlaybackEnabledDefault !== DEFAULT_PREFERENCES.loopPlaybackEnabledDefault ||
      preferences.mergeAudioEnabledDefault !== DEFAULT_PREFERENCES.mergeAudioEnabledDefault ||
      preferences.segmentPlaybackEnabledDefault !==
        DEFAULT_PREFERENCES.segmentPlaybackEnabledDefault ||
      preferences.snapPlaybackEnabledDefault !== DEFAULT_PREFERENCES.snapPlaybackEnabledDefault,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["menu"] as const,
    run() {
      dispatch(preferencesReset());
    },
    id: "reset-preferences" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|settings|preferences`),
    variant: "destructive" as const,
  };
}

export { useResetPreferencesCommand };
