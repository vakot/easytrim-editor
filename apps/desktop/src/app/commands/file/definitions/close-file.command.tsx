import { XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  type ApplicationCommandExecutionContext,
  commandOrigin,
} from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectIsChoosingSource,
  selectIsNativeDialogOpen,
} from "@/app/store/slices/import-workflow-slice";
import { selectHasSource } from "@/app/store/slices/source-slice";
import { closeActiveEditingInstanceRequested } from "@/app/store/thunks/source-media-thunks";

function useCloseFileCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const hasSource = useAppSelector(selectHasSource);
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  return {
    enabled: hasSource && !isChoosingSource && !isNativeDialogOpen,
    icon: <XIcon aria-hidden="true" />,
    async run({ surface }: ApplicationCommandExecutionContext) {
      await dispatch(closeActiveEditingInstanceRequested(commandOrigin("close-file", surface)));
    },
    id: "close-file" as const,
    label: t("app.actions.closeFile"),
    searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.closeFile")),
    shortcut: { code: "KeyQ", key: "Q", modifier: "control" } as const,
    variant: "default" as const,
  };
}

export { useCloseFileCommand };
