import { ScissorsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  type ApplicationCommandExecutionContext,
  commandOrigin,
} from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropApplied, selectTransformApplied } from "@/app/store/slices/crop-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { startFastExportRequested } from "@/app/store/thunks/export-thunks";

import { FAST_EXPORT_SHORTCUT } from "../file-shortcuts.constants";

function useFastExportCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const canExport = useAppSelector(selectSourceReady);
  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);
  return {
    enabled: canExport && !cropApplied && !transformApplied,
    icon: <ScissorsIcon aria-hidden="true" />,
    async run({ surface }: ApplicationCommandExecutionContext) {
      await dispatch(startFastExportRequested(commandOrigin("fast-export", surface)));
    },
    id: "fast-export" as const,
    label: t("export.fastExport.action"),
    searchTerms: commandSearchTerms(t("commands.searchTerms.fastExport")),
    shortcut: FAST_EXPORT_SHORTCUT,
    variant: "default" as const,
  };
}

export { useFastExportCommand };
