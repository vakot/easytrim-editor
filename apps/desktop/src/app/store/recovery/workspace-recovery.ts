import { createEditorSnapshotFromState } from "@/app/store/integration/editor-snapshot";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { selectWorkspaceHistory } from "@/app/store/slices/workspace-history-slice";
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
        messageId: "export.interruptedWhenEasyTrimClosedUnexpectedly",
      },
      status: "canceled",
    },
  };
}

function toRecoveryInstance(
  instance: EditingInstance,
  state: RootState,
): WorkspaceRecoveryInstance {
  const activeEditorMatches =
    state.editingInstances.activeInstanceId === instance.id &&
    state.source.source &&
    normalizeSourceKey(state.source.source.sourcePath) ===
      normalizeSourceKey(instance.snapshot.source.sourcePath);

  const activeSnapshot =
    activeEditorMatches && state.source.source
      ? createEditorSnapshotFromState(state, state.source.source)
      : null;

  const sourceDurationMicros = instance.media?.durationMicros ?? instance.sourceDurationMicros;

  return {
    exportAttempts: instance.exportAttempts.map(toRecoveryAttempt),
    id: instance.id,
    ...(instance.importedAtMicros === undefined
      ? {}
      : { importedAtMicros: instance.importedAtMicros }),
    ...(activeEditorMatches
      ? { optimizedArguments: state.exportPresets.argumentsText }
      : instance.optimizedArguments === undefined
        ? {}
        : { optimizedArguments: instance.optimizedArguments }),
    ...(instance.optimizedSettings === undefined
      ? {}
      : { optimizedSettings: structuredClone(instance.optimizedSettings) }),
    ...(instance.gifSettings === undefined
      ? {}
      : { gifSettings: structuredClone(instance.gifSettings) }),
    origin: instance.origin,
    ...(sourceDurationMicros === undefined ? {} : { sourceDurationMicros }),
    sourceAvailability: instance.sourceAvailability,
    snapshot: structuredClone(activeSnapshot ?? instance.snapshot),
  };
}

function createWorkspaceRecoveryBackup(
  state: RootState,
  previous?: Partial<Pick<WorkspaceRecoveryBackup, "createdAt" | "id" | "sessionId">> | null,
): WorkspaceRecoveryBackup {
  const now = new Date().toISOString();
  const history = selectWorkspaceHistory(state);
  return {
    activeInstanceId: state.editingInstances.activeInstanceId,
    createdAt: previous?.createdAt ?? now,
    id: previous?.id ?? crypto.randomUUID(),
    instances: selectEditingInstances(state).map((instance) => toRecoveryInstance(instance, state)),
    ...(history.operations.length > 0 ? { history } : {}),
    sessionId: previous?.sessionId ?? "",
    updatedAt: now,
    version: 2,
  };
}

function initializeWorkspaceRecovery(
  store: AppStore,
  sessionId: string,
  previousSessionWasAbnormal: boolean,
): void {
  candidate = previousSessionWasAbnormal
    ? promoteCurrentBackupToCandidate()
    : readRecoveryCandidate();
  candidateDismissed = false;
  if (!previousSessionWasAbnormal && !candidate) clearWorkspaceRecovery();
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
    // Until this session has work of its own, the stored current backup still belongs to the
    // previous crashed session. Overwriting it with an empty workspace would discard it if the
    // app crashes again before the user resumes.
    const state = store.getState();
    const history = selectWorkspaceHistory(state);
    if (!previousBackup && selectEditingInstances(state).length === 0 && !history.operations.length)
      return;

    const backup = createWorkspaceRecoveryBackup(state, {
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

async function retainWorkspaceRecoveryOnAcceptedShutdown(): Promise<void> {
  candidate = promoteCurrentBackupToCandidate();
  candidateDismissed = false;
  notifyCandidateChanged();
}

function getWorkspaceRecoveryCandidateSnapshot(): WorkspaceRecoveryBackup | null {
  return candidate ?? (candidate = readRecoveryCandidate());
}

export {
  createWorkspaceRecoveryBackup,
  dismissWorkspaceRecoveryNotice,
  getWorkspaceRecoveryCandidate,
  getWorkspaceRecoveryCandidateSnapshot,
  initializeWorkspaceRecovery,
  isWorkspaceRecoveryNoticeDismissed,
  retainWorkspaceRecoveryOnAcceptedShutdown,
  subscribeToWorkspaceRecovery,
};
