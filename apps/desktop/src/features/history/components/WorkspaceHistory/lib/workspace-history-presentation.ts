import type { HistoryOperation, HistoryTarget } from "@/domain/workspace-history";

function getOperationTargets(operation: HistoryOperation): HistoryTarget[] {
  if (operation.kind === "state") return operation.changes.map(({ target }) => target);
  if (operation.kind === "external") return operation.affected;
  return [];
}

function getOperationFocusInstanceId(operation: HistoryOperation): string | undefined {
  if (operation.kind !== "state" || operation.role !== "edit") return undefined;
  const target = operation.changes.find((change) => change.target.kind === "instance")?.target;
  return target?.kind === "instance" ? target.instanceId : undefined;
}

function getSourceFileName(sourcePath: string): string {
  return sourcePath.split(/[\\/]/).filter(Boolean).at(-1) ?? sourcePath;
}

export { getOperationFocusInstanceId, getOperationTargets, getSourceFileName };
