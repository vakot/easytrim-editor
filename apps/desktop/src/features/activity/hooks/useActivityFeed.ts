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
      fastCutCompleted: t("export.fastCut.completed"),
      fastCutCancelled: t("export.fastCut.cancelled"),
      fastCutFailed: t("export.fastCut.failed"),
      fastCutInterrupted: t("export.fastCut.interrupted"),
      fastCutStarted: t("export.fastCut.started"),
      fastCutting: t("export.fastCut.cutting"),
      fileCloseCompleted: (count) => t("source.close.closedFiles", { count }),
      fileDeleteCancelled: t("source.delete.cancelled"),
      fileDeleted: t("source.delete.deleted"),
      fileDeleteFailed: t("source.delete.failed"),
      fileDeleteInterrupted: t("source.delete.interrupted"),
      fileDeleting: t("source.delete.deleting"),
      fileRestoreCancelled: t("source.restore.cancelled"),
      fileRestored: t("source.restore.restored"),
      fileRestoreFailed: t("source.restore.failed"),
      fileRestoreInterrupted: t("source.restore.interrupted"),
      fileRestoring: t("source.restore.restoring"),
      importOpenedFiles: (count) => t("source.import.openedFiles", { count }),
      importOpenedFilesFromFolders: (fileCount, folderCount) =>
        `${t("source.import.openedFiles", { count: fileCount })} ${t("source.import.fromFolders", { count: folderCount })}`,
      renderCompleted: t("export.render.completed"),
      renderCancelled: t("export.render.cancelled"),
      renderFailed: t("export.render.failed"),
      renderInterrupted: t("export.render.interrupted"),
      renderStarted: t("export.render.started"),
      rendering: t("export.render.rendering"),
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
