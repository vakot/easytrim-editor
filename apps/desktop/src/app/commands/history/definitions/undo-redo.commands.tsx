import type { TFunction } from "i18next";
import { Redo2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import {
  redoWorkspaceHistory,
  undoWorkspaceHistory,
} from "@/app/store/integration/workspace-history";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import type { HistoryOperation } from "@/domain/workspace-history";

const UNDO_SHORTCUT = {
  code: "KeyZ",
  key: "Z",
  modifier: "primary",
} as const satisfies ApplicationShortcut;

const REDO_SHORTCUT = {
  code: "KeyZ",
  key: "Z",
  modifier: "primary",
  shift: true,
} as const satisfies ApplicationShortcut;

const WINDOWS_REDO_SHORTCUT = {
  code: "KeyY",
  key: "Y",
  modifier: "control",
} as const satisfies ApplicationShortcut;

function isMeaningful(operation: HistoryOperation): boolean {
  return operation.kind === "external" || (operation.kind === "state" && operation.role === "edit");
}

function findHistoryOperation(
  operations: readonly HistoryOperation[],
  position: number,
  direction: "redo" | "undo",
): HistoryOperation | undefined {
  const candidates =
    direction === "undo" ? operations.slice(0, position).reverse() : operations.slice(position);

  return candidates.find(isMeaningful);
}

function historyActionName(operation: HistoryOperation, t: TFunction): string {
  if (operation.kind !== "state") {
    return operation.label;
  }

  const fields = operation.changes.map(({ field }) => field);
  if (fields.includes("trim")) return t("commands.history.actions.trim");
  if (fields.includes("crop")) return t("commands.history.actions.crop");
  if (fields.includes("rotation")) return t("commands.history.actions.rotation");
  if (fields.some((field) => field.startsWith("flip"))) return t("commands.history.actions.flip");
  if (fields.some((field) => field.startsWith("audio:")))
    return t("commands.history.actions.audio");
  if (fields.some((field) => field.startsWith("chapter:")))
    return t("commands.history.actions.chapter");
  return operation.label;
}

function useUndoRedoCommands() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const operations = useAppSelector((state) => state.workspaceHistory.operations);
  const position = useAppSelector((state) => state.workspaceHistory.position);
  const interaction = useAppSelector((state) => state.workspaceHistory.interaction);
  const replaying = useAppSelector((state) => state.workspaceHistory.replaying);
  const undoOperation = findHistoryOperation(operations, position, "undo");
  const redoOperation = findHistoryOperation(operations, position, "redo");
  const windows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

  const undoAction = undoOperation ? historyActionName(undoOperation, t) : undefined;
  const redoAction = redoOperation ? historyActionName(redoOperation, t) : undefined;
  const undoLabel = undoAction
    ? t("commands.history.undo", { action: undoAction })
    : t("commands.history.undoGeneric");

  const redoLabel = redoAction
    ? t("commands.history.redo", { action: redoAction })
    : t("commands.history.redoGeneric");

  return [
    {
      enabled: Boolean(undoOperation) && !interaction && !replaying,
      icon: <Undo2 aria-hidden="true" />,
      id: "undo" as const,
      label: undoLabel,
      run: async () => {
        await dispatch(undoWorkspaceHistory());
      },
      searchTerms: commandSearchTerms(`${undoLabel}|undo|history|${undoAction ?? ""}`),
      shortcut: UNDO_SHORTCUT,
      surfaces: ["button", "menu", "palette", "hotkey"] as const,
      variant: "default" as const,
    },
    {
      alternateShortcuts: windows ? [WINDOWS_REDO_SHORTCUT] : undefined,
      enabled: Boolean(redoOperation) && !interaction && !replaying,
      icon: <Redo2 aria-hidden="true" />,
      id: "redo" as const,
      label: redoLabel,
      run: async () => {
        await dispatch(redoWorkspaceHistory());
      },
      searchTerms: commandSearchTerms(`${redoLabel}|redo|history|${redoAction ?? ""}`),
      shortcut: REDO_SHORTCUT,
      surfaces: ["button", "menu", "palette", "hotkey"] as const,
      variant: "default" as const,
    },
  ] as const;
}

export { useUndoRedoCommands };
