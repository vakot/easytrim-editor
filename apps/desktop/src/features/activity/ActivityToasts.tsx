import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { restoreSourceFileRequested } from "@/app/store/thunks/source-media-thunks";
import { formatExportDuration } from "@/domain/export-metrics";
import { formatBytes, formatSourcePath } from "@/features/source";
import type { DiagnosticValue } from "@/lib/tauri/diagnostics.types";
import { openFileLocation } from "@/lib/tauri/media";

import type { ActivityEntry, ActivityStatus } from "./activity-projection";
import { useActivityFeed } from "./useActivityFeed";

type ActivityToast = {
  action?: { label: string; onClick: () => void };
  description: React.ReactNode;
  title: string;
  variant: "default" | "destructive" | "success";
};

type PendingActivityToast = {
  id: string | number;
  reject: (reason?: ActivityToast) => void;
  resolve: (value: ActivityToast) => void;
};

export function ActivityToasts() {
  const { currentSessionId, entries } = useActivityFeed();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const previousEntries = useRef<Map<string, ActivityStatus> | null>(null);
  const pendingToasts = useRef<Map<string, PendingActivityToast>>(new Map());

  useEffect(() => {
    const currentEntries = entries.filter((entry) => entry.sessionId === currentSessionId);
    const previous = previousEntries.current;
    const next = new Map(currentEntries.map((entry) => [entry.id, entry.status]));

    if (!previous) {
      previousEntries.current = next;
      return;
    }

    for (const entry of currentEntries) {
      const previousStatus = previous.get(entry.id);
      if (!isToastable(entry.status)) {
        const pendingToast = pendingToasts.current.get(entry.id);
        if (pendingToast !== undefined) {
          toast.dismiss(pendingToast.id);
          pendingToasts.current.delete(entry.id);
        }
        continue;
      }
      if (previousStatus === entry.status) continue;

      const activityToast = createActivityToast(entry, instances, t, (action) => {
        if (action.kind === "open") {
          void openFileLocation(action.path).catch(() => undefined);
        } else {
          void dispatch(
            restoreSourceFileRequested({
              itemId: action.targetId,
              sourcePath: action.path,
            }),
          );
        }
      });

      if (isPromiseActivity(entry) && entry.status === "pending") {
        if (!pendingToasts.current.has(entry.id)) {
          const deferred = createDeferred<ActivityToast>();
          const toastId = toast.promise(deferred.promise, {
            description: activityToast.description,
            error: (terminalToast) => getPromiseToastResult(terminalToast),
            loading: activityToast.title,
            success: (terminalToast) => getPromiseToastResult(terminalToast),
          });

          const resolvedToastId = getToastId(toastId);
          if (resolvedToastId !== undefined) {
            pendingToasts.current.set(entry.id, {
              id: resolvedToastId,
              reject: deferred.reject,
              resolve: deferred.resolve,
            });
          }
        }
        continue;
      }

      const pendingToast = pendingToasts.current.get(entry.id);
      if (pendingToast === undefined) {
        showActivityToast(activityToast);
        continue;
      }

      pendingToasts.current.delete(entry.id);
      if (entry.status === "cancelled") {
        pendingToast.resolve(activityToast);
        setTimeout(() => showActivityToast(activityToast, pendingToast.id), 0);
      } else if (entry.status === "failed") {
        pendingToast.reject(activityToast);
      } else {
        pendingToast.resolve(activityToast);
      }
    }

    previousEntries.current = next;
  }, [currentSessionId, dispatch, entries, instances, t]);

  return null;
}

function showActivityToast(activityToast: ActivityToast, id?: string | number): void {
  const { title, variant, ...options } = activityToast;
  const toastOptions = id === undefined ? options : { ...options, id };
  if (variant === "destructive") toast.error(title, toastOptions);
  else if (variant === "success") toast.success(title, toastOptions);
  else toast(title, toastOptions);
}

function getToastId(value: ReturnType<typeof toast.promise>): string | number | undefined {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function getPromiseToastResult(activityToast: ActivityToast) {
  return {
    ...(activityToast.action ? { action: activityToast.action } : {}),
    description: activityToast.description,
    message: activityToast.title,
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: T) => void;
  resolve: (value: T) => void;
} {
  let rejectPromise!: (reason?: T) => void;
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

function isPromiseActivity(entry: ActivityEntry): boolean {
  return (
    entry.kind === "fast-cut" ||
    entry.kind === "render" ||
    entry.kind === "file-deleted" ||
    entry.kind === "file-restored"
  );
}

function createActivityToast(
  entry: ActivityEntry,
  instances: ReturnType<typeof selectEditingInstances>,
  t: ReturnType<typeof useTranslation>["t"],
  onAction: (action: NonNullable<ActivityEntry["action"]>) => void,
): ActivityToast {
  const instanceId = stringValue(entry.snapshotId) ?? stringValue(entry.data?.instanceId);
  const instance = instances.find((candidate) => candidate.id === instanceId);
  const attemptId = stringValue(entry.data?.attemptId);
  const attempt = instance?.exportAttempts.find((candidate) => candidate.id === attemptId);
  const variant =
    entry.status === "failed" || entry.status === "interrupted"
      ? "destructive"
      : entry.status === "completed"
        ? "success"
        : "default";

  return {
    action: entry.action
      ? {
          label: entry.action.kind === "open" ? t("app.actions.open") : t("app.actions.restore"),
          onClick: () => onAction(entry.action!),
        }
      : undefined,
    description: <ActivityToastDescription attempt={attempt} entry={entry} />,
    title: entry.title,
    variant,
  };
}

function ActivityToastDescription({
  attempt,
  entry,
}: {
  attempt: ReturnType<typeof selectEditingInstances>[number]["exportAttempts"][number] | undefined;
  entry: ActivityEntry;
}) {
  const { t } = useTranslation();
  const paths = stringArrayValue(entry.data?.sourcePaths);
  const outputPath =
    stringValue(entry.data?.outputPath) ??
    (attempt?.state.status === "completed" ? attempt.state.result.displayPath : entry.path);

  const sourcePath = stringValue(entry.data?.sourcePath) ?? attempt?.request.sourcePath;
  const visiblePaths = paths.slice(0, 2);
  const remainingPathCount = paths.length - visiblePaths.length;
  const fileSize = numberValue(entry.data?.fileSizeBytes) ?? attempt?.metrics.fileSizeBytes;
  const renderTime = numberValue(entry.data?.durationMs) ?? attempt?.metrics.durationMs;
  const metrics = [
    fileSize !== undefined
      ? t("app.messages.notifications.fileSize", { size: formatBytes(fileSize, "") })
      : null,
    renderTime !== null && renderTime !== undefined
      ? t("app.messages.notifications.renderTime", { duration: formatExportDuration(renderTime) })
      : null,
  ].filter((metric): metric is string => metric !== null);

  return (
    <div className="grid min-w-0 gap-0.5">
      {sourcePath ? (
        <span className="truncate" title={sourcePath}>
          {t("app.messages.notifications.sourcePath", { path: formatSourcePath(sourcePath) })}
        </span>
      ) : null}
      {outputPath ? (
        <span className="truncate" title={outputPath}>
          {t("app.messages.notifications.outputPath", { path: formatSourcePath(outputPath) })}
        </span>
      ) : null}
      {paths.length > 0 ? (
        <div className="grid gap-0.5">
          {visiblePaths.map((path) => (
            <span className="truncate" key={path} title={path}>
              {formatSourcePath(path)}
            </span>
          ))}
          {remainingPathCount > 0 ? (
            <span>{t("app.messages.notifications.moreFiles", { count: remainingPathCount })}</span>
          ) : null}
        </div>
      ) : null}
      {metrics.length > 0 ? <span>{metrics.join(" · ")}</span> : null}
    </div>
  );
}

function isToastable(status: ActivityStatus): boolean {
  return status !== "interrupted";
}

function stringValue(value: DiagnosticValue | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArrayValue(value: DiagnosticValue | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: DiagnosticValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
