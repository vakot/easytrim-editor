import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { editorSettingsReset, selectPreferences } from "@/app/store/slices/preferences-slice";

function useResetEditorSettingsCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const label = t("app.actions.resetToDefault");

  return {
    enabled:
      preferences.loopPlaybackEnabledDefault !== DEFAULT_PREFERENCES.loopPlaybackEnabledDefault ||
      preferences.mergeAudioEnabledDefault !== DEFAULT_PREFERENCES.mergeAudioEnabledDefault ||
      preferences.segmentPlaybackEnabledDefault !==
        DEFAULT_PREFERENCES.segmentPlaybackEnabledDefault,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["dialog", "menu"] as const,
    run() {
      dispatch(editorSettingsReset());
    },
    id: "reset-editor-settings" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|settings|preferences`),
    variant: "destructive" as const,
  };
}

export { useResetEditorSettingsCommand };
