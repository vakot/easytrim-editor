import type { TFunction } from "i18next";
import { Check, History as HistoryIcon, RotateCcw, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { HistoryOperation } from "@/domain/workspace-history";

import type { WorkspaceHistoryEntryState, WorkspaceHistoryRow } from "../types";

interface WorkspaceHistoryEntryProps {
  disabled: boolean;
  onSelect: (row: WorkspaceHistoryRow) => void;
  row: WorkspaceHistoryRow;
  sources: string[];
  state: WorkspaceHistoryEntryState;
}

function getActionLabel(operation: HistoryOperation, t: TFunction): string {
  if (operation.kind === "information" || operation.kind === "external") return operation.label;
  if (operation.role === "navigation") return t("history.actions.switchSource");

  const fields = operation.changes.map(({ field }) => field);
  if (fields.includes("trim")) return t("history.actions.trim");
  if (fields.includes("crop")) return t("history.actions.crop");
  if (fields.includes("rotation")) return t("history.actions.rotation");
  if (fields.some((field) => field.startsWith("flip"))) return t("history.actions.flip");
  if (fields.some((field) => field.startsWith("audio:"))) return t("history.actions.audio");
  if (fields.some((field) => field.startsWith("chapter:"))) return t("history.actions.chapter");
  return operation.label;
}

function WorkspaceHistoryEntry({
  disabled,
  onSelect,
  row,
  sources,
  state,
}: WorkspaceHistoryEntryProps) {
  const { i18n, t } = useTranslation();
  const isCurrent = state === "active";
  const isApplied = state !== "redo";
  const operation = row.operation;
  const label = operation ? getActionLabel(operation, t) : t("history.beginning");
  const timestamp = operation
    ? new Intl.DateTimeFormat(i18n.language, { hour: "numeric", minute: "2-digit" }).format(
        new Date(operation.timestamp),
      )
    : undefined;

  const actionState = isCurrent
    ? t("history.currentState")
    : isApplied
      ? t("history.applied")
      : t("history.availableRedo");

  return (
    <div className="px-1 py-0.5" key={operation?.id ?? "beginning"} role="listitem">
      <button
        aria-current={isCurrent ? "step" : undefined}
        aria-label={t("history.entryAccessibility", {
          action: label,
          state: actionState,
          sources: sources.length ? `, ${sources.join(", ")}` : "",
        })}
        className={`group flex w-full min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${
          isCurrent
            ? "border-primary/50 bg-primary/10 text-foreground"
            : isApplied
              ? "border-transparent text-foreground hover:bg-muted/70"
              : "border-transparent text-muted-foreground hover:bg-muted/50"
        }`}
        data-history-position={row.position}
        data-history-state={state}
        disabled={disabled}
        onClick={() => onSelect(row)}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
            isCurrent ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          {isCurrent ? (
            <Check className="size-3.5" />
          ) : operation?.kind === "state" && operation.role === "navigation" ? (
            <HistoryIcon className="size-3.5" />
          ) : isApplied ? (
            <RotateCcw className="size-3.5" />
          ) : (
            <RotateCw className="size-3.5" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
            {timestamp ? (
              <time
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
                dateTime={new Date(operation!.timestamp).toISOString()}
              >
                {timestamp}
              </time>
            ) : null}
          </span>
          {sources.length ? (
            <span className="truncate text-xs text-muted-foreground" title={sources.join(", ")}>
              {sources.join(", ")}
            </span>
          ) : null}
          {isCurrent ? (
            <span className="text-xs font-medium text-primary">{t("history.currentState")}</span>
          ) : !isApplied ? (
            <span className="text-xs">{t("history.availableRedo")}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}

export { WorkspaceHistoryEntry };
