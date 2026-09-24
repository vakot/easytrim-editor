import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useCloseFileCommand } from "./definitions/close-file.command";
import { useDeleteFileCommand } from "./definitions/delete-file.command";
import { useOpenFileCommand } from "./definitions/open-file.command";
import { useOpenFolderCommand } from "./definitions/open-folder.command";
import { useOptimizedExportCommand } from "./definitions/optimized-export.command";
import { useSaveLosslessCutCommand } from "./definitions/save-lossless-cut.command";

function useFileCommandGroups() {
  const { t } = useTranslation();
  const openFile = useOpenFileCommand();
  const openFolder = useOpenFolderCommand();
  const closeFile = useCloseFileCommand();
  const deleteFile = useDeleteFileCommand();
  const saveLosslessCut = useSaveLosslessCutCommand();
  const optimizedExport = useOptimizedExportCommand();
  return [
    defineApplicationCommandGroup("file", t("app.labels.commandSections.file"), [
      openFile,
      openFolder,
      closeFile,
      deleteFile,
    ] as const),
    defineApplicationCommandGroup("export", t("app.labels.commandSections.export"), [
      saveLosslessCut,
      optimizedExport,
    ] as const),
  ] as const;
}

export { useFileCommandGroups };
