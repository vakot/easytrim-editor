import { FileInputIcon } from "lucide-react";
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
import { chooseSourceRequested } from "@/app/store/thunks/source-media-thunks";

function useOpenFileCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isChoosingSource = useAppSelector(selectIsChoosingSource);
  const isNativeDialogOpen = useAppSelector(selectIsNativeDialogOpen);
  return {
    enabled: !isChoosingSource && !isNativeDialogOpen,
    icon: <FileInputIcon aria-hidden="true" />,
    async run({ surface }: ApplicationCommandExecutionContext) {
      await dispatch(chooseSourceRequested(commandOrigin("open-file", surface)));
    },
    id: "open-file" as const,
    label: t("app.actions.openFile"),
    searchTerms: commandSearchTerms(t("app.options.commandSearchTerms.openFile")),
    shortcut: { code: "KeyO", key: "O", modifier: "control" } as const,
    variant: "default" as const,
  };
}

export { useOpenFileCommand };
