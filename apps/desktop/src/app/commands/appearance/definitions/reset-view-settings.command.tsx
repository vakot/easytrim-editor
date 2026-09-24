import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectCustomPrimaryColor,
  selectPrimaryColor,
  selectThemePreference,
  viewSettingsReset,
} from "@/app/store/slices/preferences-slice";

function useResetViewSettingsCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const theme = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const customPrimaryColor = useAppSelector(selectCustomPrimaryColor);
  const label = t("settings.actions.reset");

  return {
    enabled:
      theme !== DEFAULT_PREFERENCES.theme ||
      primaryColor !== DEFAULT_PREFERENCES.primaryColor ||
      customPrimaryColor !== DEFAULT_PREFERENCES.customPrimaryColor,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["menu"] as const,
    run() {
      dispatch(viewSettingsReset());
    },
    id: "reset-view-settings" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|view|theme|color|appearance`),
    variant: "destructive" as const,
  };
}

export { useResetViewSettingsCommand };
