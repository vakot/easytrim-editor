import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useCloseFileCommand } from "./definitions/close-file.command";
import { useDeleteFileCommand } from "./definitions/delete-file.command";
import { useFastExportCommand } from "./definitions/fast-export.command";
import { useOpenFileCommand } from "./definitions/open-file.command";
import { useOpenFolderCommand } from "./definitions/open-folder.command";
import { useOptimizedExportCommand } from "./definitions/optimized-export.command";

function useFileCommandGroups() {
  const { t } = useTranslation();
  const openFile = useOpenFileCommand();
  const openFolder = useOpenFolderCommand();
  const closeFile = useCloseFileCommand();
  const deleteFile = useDeleteFileCommand();
  const fastExport = useFastExportCommand();
  const optimizedExport = useOptimizedExportCommand();
  return [
    defineApplicationCommandGroup("file", t("commands.sections.file"), [
      openFile,
      openFolder,
      closeFile,
      deleteFile,
    ] as const),
    defineApplicationCommandGroup("export", t("commands.sections.export"), [
      fastExport,
      optimizedExport,
    ] as const),
  ] as const;
}

export { useFileCommandGroups };
