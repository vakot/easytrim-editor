import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch } from "@/app/store/redux-hooks";
import { preferencesReset } from "@/app/store/slices/preferences-slice";

function useResetPreferencesCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const label = t("settings.actions.reset");
  return {
    enabled: true,
    icon: <RotateCcw aria-hidden="true" />,
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
