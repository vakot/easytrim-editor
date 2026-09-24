import { CircleStop, LogOut, Moon, Power, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  commandSearchTerms,
  defineApplicationCommandGroup,
} from "@/app/commands/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  queueFinishActionChanged,
  selectAvailableQueueFinishActions,
  selectQueueFinishAction,
} from "@/app/store/slices/export-slice";
import {
  preferenceChanged,
  selectDeleteSourceOnRenderFinish,
} from "@/app/store/slices/preferences-slice";
import { useQueueDeleteSource } from "@/features/export";
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

function useQueueCommandGroup() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { requestEnableSourceDeletion } = useQueueDeleteSource();
  const deleteSourceOnRenderFinish = useAppSelector(selectDeleteSourceOnRenderFinish);
  const queueFinishAction = useAppSelector(selectQueueFinishAction);
  const availableQueueFinishActions = useAppSelector(selectAvailableQueueFinishActions);
  const sourceSection = useMemo(
    () => ({
      id: "queue-on-finished-source",
      label: t("app.labels.commandSections.queueOnFinishedSource"),
    }),
    [t],
  );

  const applicationSection = useMemo(
    () => ({
      id: "queue-on-finished-application",
      label: t("app.labels.commandSections.queueOnFinishedApplication"),
    }),
    [t],
  );

  return useMemo(
    () =>
      defineApplicationCommandGroup("queue", [
        {
          checked: deleteSourceOnRenderFinish,
          enabled: true,
          icon: <Trash2 aria-hidden="true" />,
          run() {
            if (deleteSourceOnRenderFinish) {
              dispatch(preferenceChanged({ enabled: false, key: "deleteSourceOnRenderFinish" }));
            } else {
              requestEnableSourceDeletion();
            }
          },
          id: "delete-source-on-render-finish",
          label: t("queue.labels.deleteSource"),
          searchTerms: commandSearchTerms(`${t("queue.labels.deleteSource")}|render|queue`),
          section: sourceSection,
          variant: "destructive",
        },
        ...(
          [
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
          ] as const
        ).map(({ action, icon, id, label }) => ({
          checked: queueFinishAction === action,
          enabled: availableQueueFinishActions.includes(action),
          icon,
          run() {
            dispatch(queueFinishActionChanged(action));
          },
          id,
          label,
          searchTerms: commandSearchTerms(`${label}|queue|finish`),
          section: applicationSection,
          variant: "default" as const,
        })),
      ]),
    [
      applicationSection,
      availableQueueFinishActions,
      deleteSourceOnRenderFinish,
      dispatch,
      queueFinishAction,
      requestEnableSourceDeletion,
      sourceSection,
      t,
    ],
  );
}

export { getQueueFinishCommandId, useQueueCommandGroup };
