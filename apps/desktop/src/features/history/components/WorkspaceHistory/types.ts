import type { HistoryOperation } from "@/domain/workspace-history";

interface WorkspaceHistoryRow {
  operation?: HistoryOperation;
  position: number;
}

type WorkspaceHistoryEntryState = "active" | "applied" | "redo";

export type { WorkspaceHistoryEntryState, WorkspaceHistoryRow };
