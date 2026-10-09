import { Film } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  type ApplicationCommandExecutionContext,
  commandOrigin,
} from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { openGifExportDialog } from "@/app/store/thunks/export-thunks";

import { GIF_EXPORT_SHORTCUT } from "../file-shortcuts.constants";

function useGifExportCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(selectSourceReady);
  return {
    enabled,
    icon: <Film aria-hidden="true" />,
    async run({ surface }: ApplicationCommandExecutionContext) {
      await dispatch(openGifExportDialog(commandOrigin("gif-export", surface)));
    },
    id: "gif-export" as const,
    label: t("export.gif.action"),
    searchTerms: commandSearchTerms(t("commands.searchTerms.gifExport")),
    shortcut: GIF_EXPORT_SHORTCUT,
    variant: "default" as const,
  };
}

export { useGifExportCommand };
