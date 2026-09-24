import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { queueSettingsReset } from "@/app/store/actions/queue-actions";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAvailableQueueFinishActions,
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";
import { selectDeleteSourceOnRenderFinish } from "@/app/store/slices/preferences-slice";

function useResetQueueSettingsCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);
  const deleteSourceOnFinish = useAppSelector(selectDeleteSourceOnRenderFinish);
  const label = t("app.actions.resetToDefault");
  const defaultQueueFinishAction = availableQueueFinishActions.includes("nothing")
    ? "nothing"
    : (availableQueueFinishActions[0] ?? "nothing");

  return {
    enabled:
      queueFinishAction !== defaultQueueFinishAction ||
      deleteSourceOnFinish !== DEFAULT_PREFERENCES.deleteSourceOnRenderFinish,
    icon: <RotateCcw aria-hidden="true" />,
    surfaces: ["menu"] as const,
    run() {
      dispatch(queueSettingsReset());
    },
    id: "reset-queue-settings" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|queue|finish`),
    variant: "destructive" as const,
  };
}

export { useResetQueueSettingsCommand };
