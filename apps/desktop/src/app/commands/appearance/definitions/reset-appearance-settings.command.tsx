import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  appearanceSettingsReset,
  selectPrimaryColor,
  selectThemePreference,
  selectUiScalePercent,
} from "@/app/store/slices/preferences-slice";

function useResetAppearanceSettingsCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const theme = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const uiScalePercent = useAppSelector(selectUiScalePercent);
  const label = t("app.actions.resetToDefault");

  return {
    enabled:
      theme !== DEFAULT_PREFERENCES.theme ||
      primaryColor !== DEFAULT_PREFERENCES.primaryColor ||
      uiScalePercent !== DEFAULT_PREFERENCES.uiScalePercent,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["dialog"] as const,
    run() {
      dispatch(appearanceSettingsReset());
    },
    id: "reset-appearance-settings" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|appearance|theme|color|scaling`),
    variant: "destructive" as const,
  };
}

export { useResetAppearanceSettingsCommand };
