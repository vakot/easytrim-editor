import { useTranslation } from "react-i18next";

import { defineApplicationCommandGroup } from "@/app/commands/core/application-command.utils";

import { useUndoRedoCommands } from "./definitions/undo-redo.commands";

function useHistoryCommandGroups() {
  const { t } = useTranslation();
  const [undo, redo] = useUndoRedoCommands();

  return [
    defineApplicationCommandGroup("edit", t("commands.sections.edit"), [undo, redo] as const),
  ] as const;
}

export { useHistoryCommandGroups };
