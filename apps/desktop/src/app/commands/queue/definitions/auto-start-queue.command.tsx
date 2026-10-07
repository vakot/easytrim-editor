import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  selectAutoStartQueueEnabled,
} from "@/app/store/slices/preferences-slice";

function useAutoStartQueueCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectAutoStartQueueEnabled);
  const label = t("settings.queue.autoStart.label");

  return {
    checked,
    enabled: true,
    icon: <Play aria-hidden="true" />,
    run() {
      dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: !checked }));
    },
    id: "preference-auto-start-queue" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|queue|setting`),
    variant: "default" as const,
  };
}

export { useAutoStartQueueCommand };
