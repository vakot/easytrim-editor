import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueueSummary } from "@/app/store/slices/editing-instances-slice";

function useStartQueueCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const summary = useAppSelector(selectExportQueueSummary);
  const label = t("queue.actions.startQueue");

  return {
    enabled: summary.queued > 0,
    icon: <Play aria-hidden="true" />,
    id: "start-export-queue" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|start|queued exports`),
    surfaces: ["palette", "button"] as const,
    async run() {
      const { startExportQueue } = await import("@/app/store/thunks/export-thunks");
      await dispatch(startExportQueue());
    },
    variant: "default" as const,
  };
}

export { useStartQueueCommand };
