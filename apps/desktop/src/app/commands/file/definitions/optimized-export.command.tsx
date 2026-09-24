import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  type ApplicationCommandExecutionContext,
  commandOrigin,
} from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog } from "@/app/store/thunks/export-thunks";

function useOptimizedExportCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectSourceReady);
  return {
    enabled,
    icon: <Settings2 aria-hidden="true" />,
    async run({ surface }: ApplicationCommandExecutionContext) {
      await dispatch(openOptimizedExportDialog(commandOrigin("optimized-export", surface)));
    },
    id: "optimized-export" as const,
    label: t("export.actions.optimized"),
    searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.optimizedExport")),
    shortcut: { code: "KeyE", key: "E", modifier: "control" } as const,
    variant: "default" as const,
  };
}

export { useOptimizedExportCommand };
