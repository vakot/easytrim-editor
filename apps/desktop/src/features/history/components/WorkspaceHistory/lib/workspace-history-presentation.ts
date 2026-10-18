import type { HistoryOperation, HistoryTarget } from "@/domain/workspace-history";

function getOperationTargets(operation: HistoryOperation): HistoryTarget[] {
  if (operation.kind === "state") return operation.changes.map(({ target }) => target);
  if (operation.kind === "external") return operation.affected;
  return [];
}

function getOperationInstanceId(operation: HistoryOperation): string | undefined {
  if (operation.kind === "state") {
    const target = operation.changes.find((change) => change.target.kind === "instance")?.target;
    if (target?.kind === "instance") return target.instanceId;
    if (operation.role === "navigation") {
      const activeChange = operation.changes.find(
        (change) => change.target.kind === "workspace" && change.field === "activeInstanceId",
      );

      const id = activeChange?.after.present ? activeChange.after.value : undefined;
      return typeof id === "string" ? id : undefined;
    }
    return undefined;
  }

  return operation.kind === "external"
    ? operation.affected.find((target) => target.kind === "instance")?.instanceId
    : undefined;
}

function getSourceFileName(sourcePath: string): string {
  return sourcePath.split(/[\\/]/).filter(Boolean).at(-1) ?? sourcePath;
}

export { getOperationInstanceId, getOperationTargets, getSourceFileName };
