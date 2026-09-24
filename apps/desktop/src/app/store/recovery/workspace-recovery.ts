import { createEditorSnapshotFromState } from "@/app/store/integration/editor-snapshot";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import type { AppStore, RootState } from "@/app/store/store";
import type { EditingInstance, ExportAttempt } from "@/domain/editing-instance";
import { EMPTY_EXPORT_METRICS } from "@/domain/editing-instance";
import { normalizeSourceKey } from "@/domain/source";
import { diagnostics } from "@/lib/diagnostics";

import {
  clearWorkspaceRecovery,
  promoteCurrentBackupToCandidate,
  readRecoveryCandidate,
  writeCurrentBackup,
} from "./workspace-recovery.storage";
import type {
  WorkspaceRecoveryBackup,
  WorkspaceRecoveryInstance,
} from "./workspace-recovery.types";

let candidate: WorkspaceRecoveryBackup | null = null;
const listeners = new Set<() => void>();
let candidateDismissed = false;

function getWorkspaceRecoveryCandidate(): WorkspaceRecoveryBackup | null {
  return candidate;
}

function isWorkspaceRecoveryNoticeDismissed(): boolean {
  return candidateDismissed;
}

function subscribeToWorkspaceRecovery(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyCandidateChanged(): void {
  for (const listener of listeners) listener();
}

function dismissWorkspaceRecoveryNotice(): void {
  if (candidateDismissed) return;
  candidateDismissed = true;
  diagnostics.event("workspace.recovery.dismissed", {
    data: { backupId: candidate?.id ?? "" },
    origin: { id: "workspace-recovery-notice", type: "button" },
  });
  notifyCandidateChanged();
}

function toRecoveryAttempt(attempt: ExportAttempt): ExportAttempt {
  if (attempt.state.status !== "queued" && attempt.state.status !== "rendering") return attempt;
  return {
    ...attempt,
    metrics: {
      ...EMPTY_EXPORT_METRICS,
      ...(attempt.metrics.totalFrames === undefined
        ? {}
        : { totalFrames: attempt.metrics.totalFrames }),
    },
    state: {
      canceledAt:
        attempt.state.status === "queued" ? attempt.state.queuedAt : attempt.state.startedAt,
      error: {
        code: "export_interrupted",
        message: "The export was interrupted when EasyTrim closed unexpectedly.",
      },
      status: "canceled",
    },
  };
}

function toRecoveryInstance(
  instance: EditingInstance,
  state: RootState,
): WorkspaceRecoveryInstance {
  const activeSnapshot =
    state.editingInstances.activeInstanceId === instance.id &&
    state.source.source &&
    normalizeSourceKey(state.source.source.sourcePath) ===
      normalizeSourceKey(instance.snapshot.source.sourcePath)
      ? createEditorSnapshotFromState(state, state.source.source)
      : null;

  return {
    exportAttempts: instance.exportAttempts.map(toRecoveryAttempt),
    id: instance.id,
    ...(instance.importedAtMicros === undefined
      ? {}
      : { importedAtMicros: instance.importedAtMicros }),
    ...(instance.optimizedArguments === undefined
      ? {}
      : { optimizedArguments: instance.optimizedArguments }),
    ...(instance.optimizedSettings === undefined
      ? {}
      : { optimizedSettings: structuredClone(instance.optimizedSettings) }),
    origin: instance.origin,
    sourceAvailability: instance.sourceAvailability,
    snapshot: structuredClone(activeSnapshot ?? instance.snapshot),
  };
}

function createWorkspaceRecoveryBackup(
  state: RootState,
  previous?: Partial<Pick<WorkspaceRecoveryBackup, "createdAt" | "id" | "sessionId">> | null,
): WorkspaceRecoveryBackup {
  const now = new Date().toISOString();
  return {
    activeInstanceId: state.editingInstances.activeInstanceId,
    createdAt: previous?.createdAt ?? now,
    id: previous?.id ?? crypto.randomUUID(),
    instances: selectEditingInstances(state).map((instance) => toRecoveryInstance(instance, state)),
    sessionId: previous?.sessionId ?? "",
    updatedAt: now,
    version: 1,
  };
}

function initializeWorkspaceRecovery(
  store: AppStore,
  sessionId: string,
  previousSessionWasAbnormal: boolean,
): void {
  candidate = previousSessionWasAbnormal ? promoteCurrentBackupToCandidate() : null;
  candidateDismissed = false;
  if (!previousSessionWasAbnormal) {
    // A stale candidate must never be presented after diagnostics reports a clean startup.
    clearWorkspaceRecovery();
  }
  if (candidate) {
    diagnostics.event("workspace.recovery.available", {
      data: {
        backupId: candidate.id,
        previousSessionId: candidate.sessionId,
        sourceCount: candidate.instances.length,
      },
      origin: { id: "workspace-recovery", type: "restore" },
    });
    notifyCandidateChanged();
  }

  let previousBackup: WorkspaceRecoveryBackup | null = null;
  const save = () => {
    const backup = createWorkspaceRecoveryBackup(store.getState(), {
      createdAt: previousBackup?.createdAt,
      id: previousBackup?.id,
      sessionId,
    });

    const content = JSON.stringify({ ...backup, updatedAt: "" });
    if (previousBackup && JSON.stringify({ ...previousBackup, updatedAt: "" }) === content) return;
    previousBackup = { ...backup, updatedAt: new Date().toISOString() };
    writeCurrentBackup(previousBackup);
  };

  store.subscribe(save);
  save();
}

async function clearWorkspaceRecoveryOnAcceptedShutdown(): Promise<void> {
  clearWorkspaceRecovery();
  candidate = null;
  candidateDismissed = true;
  notifyCandidateChanged();
}

function getWorkspaceRecoveryCandidateSnapshot(): WorkspaceRecoveryBackup | null {
  return candidate ?? (candidate = readRecoveryCandidate());
}

export {
  clearWorkspaceRecoveryOnAcceptedShutdown,
  createWorkspaceRecoveryBackup,
  dismissWorkspaceRecoveryNotice,
  getWorkspaceRecoveryCandidate,
  getWorkspaceRecoveryCandidateSnapshot,
  initializeWorkspaceRecovery,
  isWorkspaceRecoveryNoticeDismissed,
  subscribeToWorkspaceRecovery,
};
