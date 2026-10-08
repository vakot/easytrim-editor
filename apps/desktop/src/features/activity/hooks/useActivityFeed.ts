import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import {
  getCurrentDiagnosticSessionId,
  getCurrentDiagnosticSessionMetadata,
  getCurrentSessionDiagnosticsSnapshot,
  subscribeToCurrentSessionDiagnostics,
} from "@/lib/diagnostics";
import {
  getPersistedDiagnosticsHistorySnapshot,
  loadPersistedDiagnosticsHistory,
  subscribeToPersistedDiagnosticsHistory,
} from "@/lib/diagnostics-history";
import type { DiagnosticSessionMetadata } from "@/lib/tauri/diagnostics.types";

import {
  type ActivityEntry,
  type ActivityProjectionLabels,
  projectActivityEvents,
  resolveAvailableActivityActions,
} from "../lib/activity-projection";

function useActivityFeed() {
  const { t } = useTranslation();
  const diagnosticSnapshot = useSyncExternalStore(
    subscribeToCurrentSessionDiagnostics,
    getCurrentSessionDiagnosticsSnapshot,
    getCurrentSessionDiagnosticsSnapshot,
  );

  const historySnapshot = useSyncExternalStore(
    subscribeToPersistedDiagnosticsHistory,
    getPersistedDiagnosticsHistorySnapshot,
    getPersistedDiagnosticsHistorySnapshot,
  );

  useEffect(() => {
    void loadPersistedDiagnosticsHistory();
  }, []);

  const labels = useMemo<ActivityProjectionLabels>(
    () => ({
      fastCutCompleted: t("export.losslessCut.completed"),
      fastCutCancelled: t("export.losslessCut.cancelled"),
      fastCutFailed: t("export.losslessCut.failed"),
      fastCutInterrupted: t("export.losslessCut.interrupted"),
      fastCutStarted: t("export.losslessCut.started"),
      fastCutting: t("export.losslessCut.cutting"),
      fileCloseCompleted: (count) => t("source.close.closedFiles", { count }),
      fileDeleteCancelled: t("source.delete.cancelled"),
      fileDeleted: t("source.delete.completed"),
      fileDeleteFailed: t("source.delete.failed"),
      fileDeleteInterrupted: t("source.delete.interrupted"),
      fileDeleting: t("source.delete.deleting"),
      fileRestoreCancelled: t("source.restore.cancelled"),
      fileRestored: t("source.restore.completed"),
      fileRestoreFailed: t("source.restore.failed"),
      fileRestoreInterrupted: t("source.restore.interrupted"),
      fileRestoring: t("source.restore.restoring"),
      importOpenedFiles: (count) => t("source.import.openedFiles", { count }),
      importOpenedFilesFromFolders: (fileCount, folderCount) =>
        `${t("source.import.openedFiles", { count: fileCount })} ${t("source.import.fromFolders", { count: folderCount })}`,
      renderCompleted: t("export.optimized.completed"),
      renderCancelled: t("export.optimized.cancelled"),
      renderFailed: t("export.optimized.failed"),
      renderInterrupted: t("export.optimized.interrupted"),
      renderStarted: t("export.optimized.started"),
      rendering: t("export.optimized.running"),
      workspaceRestored: (restored, total) =>
        restored === total
          ? t("app.workspaceRecovery.restored", { count: restored })
          : t("app.workspaceRecovery.partiallyRestored", { restored, total }),
    }),
    [t],
  );

  const currentSession = getCurrentDiagnosticSessionMetadata();
  const currentSessionId = currentSession?.sessionId ?? getCurrentDiagnosticSessionId();
  const entries = useMemo(
    () =>
      resolveAvailableActivityActions(
        projectActivityEvents(
          [...historySnapshot.events, ...diagnosticSnapshot.events],
          labels,
          currentSessionId,
        ),
        currentSessionId,
      ),
    [currentSessionId, diagnosticSnapshot, historySnapshot, labels],
  );

  const sessions = currentSession
    ? [currentSession, ...historySnapshot.sessions]
    : historySnapshot.sessions;

  return { currentSessionId, entries, sessions } satisfies {
    currentSessionId: string | null;
    entries: ActivityEntry[];
    sessions: readonly DiagnosticSessionMetadata[];
  };
}

export { useActivityFeed };
