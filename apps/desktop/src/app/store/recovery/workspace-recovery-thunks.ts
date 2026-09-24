import {
  activeEditingInstanceChanged,
  editingInstancesAdded,
  editingInstancesSourceAvailabilityChanged,
  selectEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { sourceCleared } from "@/app/store/actions/source-actions";
import type { EditingInstance } from "@/domain/editing-instance";
import { diagnostics } from "@/lib/diagnostics";
import { activateSourcePath } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

import { activateEditingInstanceRequested } from "../thunks/source-media-thunks";
import type { AppThunk } from "../thunks/source-media-thunks";
import { getWorkspaceRecoveryCandidateSnapshot } from "./workspace-recovery";
import type { WorkspaceRecoveryInstance } from "./workspace-recovery.types";

function toEditingInstance(instance: WorkspaceRecoveryInstance): EditingInstance {
  return {
    exportAttempts: instance.exportAttempts,
    id: instance.id,
    ...(instance.importedAtMicros === undefined
      ? {}
      : { importedAtMicros: instance.importedAtMicros }),
    ...(instance.optimizedArguments === undefined
      ? {}
      : { optimizedArguments: instance.optimizedArguments }),
    ...(instance.optimizedSettings === undefined
      ? {}
      : { optimizedSettings: instance.optimizedSettings }),
    origin: instance.origin,
    snapshot: instance.snapshot,
    sourceAvailability: instance.sourceAvailability,
  };
}

const restorePreviousWorkspaceRequested =
  (): AppThunk<Promise<boolean>> => async (dispatch, getState) => {
    const backup = getWorkspaceRecoveryCandidateSnapshot();
    if (!backup) return false;
    if (selectEditingInstances(getState()).length > 0) {
      diagnostics.event("workspace.recovery.ignored", {
        data: { reason: "workspace_not_empty" },
        origin: { id: "workspace-recovery", type: "restore" },
        result: "ignored",
      });
      return false;
    }

    const recoveryInfo = diagnostics.getStartupRecovery();
    const classification = recoveryInfo?.classification ?? "abnormal_shutdown";
    const operation = diagnostics.startOperation("workspace.recovery", {
      data: {
        activeInstanceId: backup.activeInstanceId,
        backupCreatedAt: backup.createdAt,
        backupId: backup.id,
        backupUpdatedAt: backup.updatedAt,
        classification,
        previousSessionId: backup.sessionId,
        sourceCount: backup.instances.length,
      },
      origin: { id: "workspace-recovery", type: "restore" },
    });

    try {
      const restored: EditingInstance[] = [];
      let missingSourceCount = 0;
      const missingSourceIds: string[] = [];
      for (const savedInstance of backup.instances) {
        if (savedInstance.sourceAvailability !== "available") {
          restored.push(toEditingInstance(savedInstance));
          continue;
        }
        try {
          const source = await activateSourcePath(savedInstance.snapshot.source.sourcePath);
          restored.push({
            ...toEditingInstance(savedInstance),
            snapshot: { ...savedInstance.snapshot, source },
          });
        } catch {
          missingSourceCount += 1;
          missingSourceIds.push(savedInstance.id);
        }
      }

      if (restored.length === 0) {
        const error = new Error("No previous-session source files are available.");
        operation.fail(error, { missingSourceCount, reason: "no_sources_available" });
        return false;
      }

      dispatch(editingInstancesAdded(restored));
      const available = restored.filter((instance) => instance.sourceAvailability === "available");
      const preferred = available.find((instance) => instance.id === backup.activeInstanceId);
      let activeInstanceRestored = false;
      let activeInstanceId: string | null = null;
      const activationFailures = new Set<string>();
      const activationOrder = [
        ...(preferred ? [preferred] : []),
        ...available.filter((instance) => instance.id !== preferred?.id),
      ];

      for (const instance of activationOrder) {
        if (await dispatch(activateEditingInstanceRequested(instance))) {
          activeInstanceId = instance.id;
          activeInstanceRestored = instance.id === backup.activeInstanceId;
          break;
        }
        activationFailures.add(instance.id);
      }

      if (!activeInstanceId) {
        activationOrder.forEach((instance) => activationFailures.add(instance.id));
        dispatch(sourceCleared());
        dispatch(activeEditingInstanceChanged(null));
      }
      if (activationFailures.size > 0) {
        missingSourceCount += activationFailures.size;
        missingSourceIds.push(...activationFailures);
        for (const instance of restored) {
          if (!activationFailures.has(instance.id)) continue;
          dispatch(
            editingInstancesSourceAvailabilityChanged({
              availability: "missing",
              sourcePath: instance.snapshot.source.sourcePath,
            }),
          );
        }
      }

      const exportResultCount = backup.instances.reduce(
        (count, instance) =>
          count +
          instance.exportAttempts.filter((attempt) => attempt.state.status === "completed").length,
        0,
      );
      operation.complete({
        activeInstanceId,
        activeInstanceRestored,
        exportResultCount,
        missingSourceCount,
        missingSourceIds,
        restoredSourceCount: backup.instances.length - missingSourceCount,
        sourceCount: backup.instances.length,
      });
      return true;
    } catch (error: unknown) {
      operation.fail(normalizeAppError(error), { reason: "restore_failed" });
      return false;
    }
  };

export { restorePreviousWorkspaceRequested };
