import { CircleStop, LogOut, Moon, Power } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  queueFinishActionChanged,
  selectAvailableQueueFinishActions,
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";
import type { QueueFinishAction } from "@/lib/tauri/queue.types";

function getQueueFinishCommandId(action: QueueFinishAction) {
  switch (action) {
    case "exit":
      return "queue-finish-exit";
    case "nothing":
      return "queue-finish-nothing";
    case "systemShutdown":
      return "queue-finish-system-shutdown";
    case "systemSleep":
      return "queue-finish-system-sleep";
  }
}

function useQueueFinishCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selected = useAppSelector(selectQueueFinishAction);
  const available = useAppSelector(selectAvailableQueueFinishActions);
  const definitions = [
    {
      action: "exit",
      id: "queue-finish-exit",
      icon: <LogOut aria-hidden="true" />,
      label: t("queue.options.finishActions.exit"),
    },
    {
      action: "nothing",
      id: "queue-finish-nothing",
      icon: <CircleStop aria-hidden="true" />,
      label: t("queue.options.finishActions.nothing"),
    },
    {
      action: "systemSleep",
      id: "queue-finish-system-sleep",
      icon: <Moon aria-hidden="true" />,
      label: t("queue.options.finishActions.systemSleep"),
    },
    {
      action: "systemShutdown",
      id: "queue-finish-system-shutdown",
      icon: <Power aria-hidden="true" />,
      label: t("queue.options.finishActions.systemShutdown"),
    },
  ] as const;

  return definitions.map(({ action, icon, id, label }) => ({
    checked: selected === action,
    enabled: available.includes(action),
    icon,
    run() {
      dispatch(queueFinishActionChanged(action));
    },
    id,
    label,
    searchTerms: commandSearchTerms(`${label}|queue|finish`),
    variant: "default" as const,
  }));
}

export { getQueueFinishCommandId, useQueueFinishCommands };
