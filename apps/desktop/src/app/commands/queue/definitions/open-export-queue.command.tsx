import { List } from "lucide-react";
import { useTranslation } from "react-i18next";

import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch } from "@/app/store/redux-hooks";
import { exportQueueDialogOpened } from "@/app/store/slices/export-slice";

function useOpenExportQueueCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const label = t("queue.actions.openExportQueue");

  return {
    enabled: true,
    icon: <List aria-hidden="true" />,
    id: "open-export-queue" as const,
    label,
    searchTerms: commandSearchTerms(`${label}|open|export|queue`),
    surfaces: ["menu", "palette"] as const,
    run() {
      dispatch(exportQueueDialogOpened());
    },
    variant: "default" as const,
  };
}

export { useOpenExportQueueCommand };
