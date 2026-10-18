import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { applyHistoryPosition } from "@/app/store/integration/workspace-history";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import type { RootState } from "@/app/store/store";
import type { HistoryTarget } from "@/domain/workspace-history";
import { cn } from "@/lib/class-names.utils";

import { WorkspaceHistoryEmpty } from "./components/WorkspaceHistoryEmpty";
import { WorkspaceHistoryList } from "./components/WorkspaceHistoryList";
import {
  getOperationFocusInstanceId,
  getOperationTargets,
  getSourceFileName,
} from "./lib/workspace-history-presentation";
import type { WorkspaceHistoryRow } from "./types";

function WorkspaceHistory({ className }: { className?: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const operations = useAppSelector((state) => state.workspaceHistory.operations);
  const position = useAppSelector((state) => state.workspaceHistory.position);
  const interaction = useAppSelector((state) => state.workspaceHistory.interaction);
  const replaying = useAppSelector((state) => state.workspaceHistory.replaying);
  const instances = useAppSelector((state) => state.editingInstances.entities);

  const rows = useMemo<WorkspaceHistoryRow[]>(
    () => [
      { position: 0 },
      ...operations.map((operation, index) => ({ operation, position: index + 1 })),
    ],
    [operations],
  );

  const sourcesFor = useCallback(
    (row: WorkspaceHistoryRow) => {
      if (!row.operation) return [];
      const labels = getOperationTargets(row.operation)
        .map((target) => sourceLabelFor(target, instances, t))
        .filter((source): source is string => Boolean(source));

      return [...new Set(labels)];
    },
    [instances, t],
  );

  const stateFor = useCallback(
    (row: WorkspaceHistoryRow) =>
      row.position === position ? "active" : row.position < position ? "applied" : "redo",
    [position],
  );

  const handleSelect = useCallback(
    (row: WorkspaceHistoryRow) => {
      if (row.position === position || interaction || replaying) return;
      const focusInstanceId = row.operation
        ? getOperationFocusInstanceId(row.operation)
        : undefined;

      void dispatch(
        applyHistoryPosition(
          row.position,
          true,
          focusInstanceId ? { preferredInstanceId: focusInstanceId } : undefined,
        ),
      );
    },
    [dispatch, interaction, position, replaying],
  );

  return (
    <section
      aria-label={t("history.title")}
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}
    >
      {operations.length === 0 ? (
        <WorkspaceHistoryEmpty />
      ) : (
        <WorkspaceHistoryList
          disabled={Boolean(interaction) || replaying}
          onSelect={handleSelect}
          rows={rows}
          sourcesFor={sourcesFor}
          stateFor={stateFor}
        />
      )}
    </section>
  );
}

function sourceLabelFor(
  target: HistoryTarget,
  instances: RootState["editingInstances"]["entities"],
  t: TFunction,
): string | undefined {
  if (target.kind === "workspace") return undefined;
  const instance = target.kind === "instance" ? instances[target.instanceId] : undefined;
  const displayName = instance?.snapshot.source.displayName ?? getSourceFileName(target.sourceId);
  return target.kind === "instance"
    ? t("history.sourceInstance", { instance: target.instanceId, source: displayName })
    : displayName;
}

export { WorkspaceHistory };
