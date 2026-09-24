import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  selectDeleteSourceOnRenderFinish,
} from "@/app/store/slices/preferences-slice";
import { useQueueDeleteSource } from "@/features/export";

function useDeleteSourceOnFinishCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { requestEnableSourceDeletion } = useQueueDeleteSource();
  const checked = useAppSelector(selectDeleteSourceOnRenderFinish);
  const label = t("queue.labels.deleteSource");
  return {
    checked,
    enabled: true,
    icon: <Trash2 aria-hidden="true" />,
    run() {
      if (checked)
        dispatch(preferenceChanged({ enabled: false, key: "deleteSourceOnRenderFinish" }));
      else requestEnableSourceDeletion();
    },
    id: "delete-source-on-render-finish" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|render|queue`),
    variant: "destructive" as const,
  };
}

export { useDeleteSourceOnFinishCommand };
