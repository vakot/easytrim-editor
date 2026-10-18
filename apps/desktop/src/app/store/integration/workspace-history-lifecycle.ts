import { historyOperationRecorded } from "@/app/store/slices/workspace-history-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";
import type { HistoryOperation, HistoryTarget, HistoryValue } from "@/domain/workspace-history";

type IndexedInstance = { index: number; instance: EditingInstance };

function historyInstance(instance: EditingInstance): EditingInstance {
  const copy = structuredClone(instance);
  copy.exportAttempts = [];
  delete copy.media;
  return copy;
}

function recordInstanceLifecycle(
  dispatch: AppDispatch,
  label: string,
  before: IndexedInstance[],
  after: IndexedInstance[],
  beforeActiveId: string | null,
  afterActiveId: string | null,
) {
  const affected: HistoryTarget[] = [...before, ...after].map(({ instance }) => ({
    kind: "instance",
    instanceId: instance.id,
    sourceId: instance.snapshot.source.sourcePath,
  }));

  const payload = {
    after: after.map(({ index, instance }) => ({ index, instance: historyInstance(instance) })),
    afterActiveId,
    before: before.map(({ index, instance }) => ({ index, instance: historyInstance(instance) })),
    beforeActiveId,
  } as unknown as HistoryValue;

  const operation: HistoryOperation = {
    affected,
    id: crypto.randomUUID(),
    kind: "external",
    label,
    payload,
    timestamp: Date.now(),
    type: "instances.lifecycle",
  };

  dispatch(historyOperationRecorded(operation));
}

function recordSourceAvailability(
  dispatch: AppDispatch,
  sourcePath: string,
  before: "available" | "deleted",
  after: "available" | "deleted",
  label: string,
  instanceIds: string[],
) {
  if (before === after) return;
  const operation: HistoryOperation = {
    affected: [
      { kind: "source", sourceId: sourcePath },
      ...instanceIds.map((instanceId) => ({
        kind: "instance" as const,
        instanceId,
        sourceId: sourcePath,
      })),
    ],
    id: crypto.randomUUID(),
    kind: "external",
    label,
    payload: { after, before, sourcePath },
    timestamp: Date.now(),
    type: "source.availability",
  };

  dispatch(historyOperationRecorded(operation));
}

function recordInstanceNavigation(
  dispatch: AppDispatch,
  before: string | null,
  after: string | null,
) {
  if (before === after) return;
  const operation: HistoryOperation = {
    changes: [
      {
        after: { present: true, value: after },
        before: { present: true, value: before },
        field: "activeInstanceId",
        target: { kind: "workspace" },
      },
    ],
    id: crypto.randomUUID(),
    kind: "state",
    label: "Switch editing instance",
    role: "navigation",
    timestamp: Date.now(),
  };

  dispatch(historyOperationRecorded(operation));
}

function lifecycleInstances(state: RootState, ids: string[]): IndexedInstance[] {
  return ids.flatMap((id) => {
    const index = state.editingInstances.ids.indexOf(id);
    const instance = state.editingInstances.entities[id];
    if (index < 0 || !instance) return [];
    return [{ index, instance: historyInstance(instance) }];
  });
}

export {
  lifecycleInstances,
  recordInstanceLifecycle,
  recordInstanceNavigation,
  recordSourceAvailability,
};
export type { IndexedInstance };
