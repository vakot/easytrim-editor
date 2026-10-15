import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  editingSettingsReset,
  selectMergeAudioEnabled,
  selectStripMetadataOnExport,
} from "@/app/store/slices/preferences-slice";

function useResetEditingSettingsCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const mergeAudioEnabled = useAppSelector(selectMergeAudioEnabled);
  const stripMetadataOnExport = useAppSelector(selectStripMetadataOnExport);
  const label = t("common.actions.resetToDefault");

  return {
    enabled:
      mergeAudioEnabled !== DEFAULT_PREFERENCES.mergeAudioEnabled ||
      stripMetadataOnExport !== DEFAULT_PREFERENCES.stripMetadataOnExport,
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
