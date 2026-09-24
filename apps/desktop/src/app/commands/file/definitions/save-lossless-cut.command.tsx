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
import { startFastCutRequested } from "@/app/store/thunks/export-thunks";

function useSaveLosslessCutCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const canExport = useAppSelector(selectSourceReady);
  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);
  return {
    enabled: canExport && !cropApplied && !transformApplied,
    icon: <ScissorsIcon aria-hidden="true" />,
    async run({ surface }: ApplicationCommandExecutionContext) {
      await dispatch(startFastCutRequested(commandOrigin("save-lossless-cut", surface)));
    },
    id: "save-lossless-cut" as const,
    label: t("export.actions.fast"),
    searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.saveLosslessCut")),
    shortcut: { code: "KeyS", key: "S", modifier: "control" } as const,
    variant: "default" as const,
  };
}

export { useSaveLosslessCutCommand };
