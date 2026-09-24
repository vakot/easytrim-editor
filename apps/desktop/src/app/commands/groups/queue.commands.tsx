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
    () => ({ id: "queue-on-finished-source", label: t("app.labels.commandSections.queueOnFinishedSource") }),
    [t],
  );
  const applicationSection = useMemo(
    () => ({ id: "queue-on-finished-application", label: t("app.labels.commandSections.queueOnFinishedApplication") }),
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
            ["exit", "queue-finish-exit", <LogOut aria-hidden="true" />],
            ["nothing", "queue-finish-nothing", <CircleStop aria-hidden="true" />],
            ["systemSleep", "queue-finish-system-sleep", <Moon aria-hidden="true" />],
            ["systemShutdown", "queue-finish-system-shutdown", <Power aria-hidden="true" />],
          ] as const satisfies readonly (readonly [QueueFinishAction, string, React.ReactNode])[]
        ).map(([action, id, icon]) => ({
          checked: queueFinishAction === action,
          enabled: availableQueueFinishActions.includes(action),
          icon,
          run() {
            dispatch(queueFinishActionChanged(action));
          },
          id,
          label: t(
            `queue.options.finishActions.${action === "systemSleep" ? "systemSleep" : action === "systemShutdown" ? "systemShutdown" : action}`,
          ),
          searchTerms: commandSearchTerms(
            `${t(`queue.options.finishActions.${action === "systemSleep" ? "systemSleep" : action === "systemShutdown" ? "systemShutdown" : action}`)}|queue|finish`,
          ),
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
