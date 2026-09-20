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

export function useActivityFeed() {
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
      fastCutCompleted: t("app.status.fastCutCompleted"),
      fastCutCancelled: t("app.status.fastCutCancelled"),
      fastCutFailed: t("app.status.fastCutFailed"),
      fastCutInterrupted: t("app.status.fastCutInterrupted"),
      fastCutStarted: t("app.status.fastCutStarted"),
      fastCutting: t("app.status.fastCutting"),
      fileCloseCompleted: (count) => t("app.status.closedFiles", { count }),
      fileDeleteCancelled: t("app.status.fileDeleteCancelled"),
      fileDeleted: t("app.status.fileDeleted"),
      fileDeleteFailed: t("app.status.fileDeleteFailed"),
      fileDeleteInterrupted: t("app.status.fileDeleteInterrupted"),
      fileDeleting: t("app.status.fileDeleting"),
      fileRestoreCancelled: t("app.status.fileRestoreCancelled"),
      fileRestored: t("app.status.fileRestored"),
      fileRestoreFailed: t("app.status.fileRestoreFailed"),
      fileRestoreInterrupted: t("app.status.fileRestoreInterrupted"),
      fileRestoring: t("app.status.fileRestoring"),
      importOpenedFiles: (count) => t("app.status.openedFiles", { count }),
      importOpenedFilesFromFolders: (fileCount, folderCount) =>
        `${t("app.status.openedFiles", { count: fileCount })} ${t("app.status.fromFolders", { count: folderCount })}`,
      renderCompleted: t("app.status.renderCompleted"),
      renderCancelled: t("app.status.renderCancelled"),
      renderFailed: t("app.status.renderFailed"),
      renderInterrupted: t("app.status.renderInterrupted"),
      renderStarted: t("app.status.renderStarted"),
      rendering: t("app.status.rendering"),
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
