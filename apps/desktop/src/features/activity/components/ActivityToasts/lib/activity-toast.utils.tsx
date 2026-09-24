import type { TFunction } from "i18next";
import { toast } from "sonner";

import type { EditingInstance } from "@/domain/editing-instance";
import type { DiagnosticValue } from "@/lib/tauri/diagnostics.types";

import type { ActivityEntry, ActivityStatus } from "../../../lib/activity-projection";
import { ActivityToastDescription } from "../components/ActivityToastDescription";

export type ActivityToast = {
  action?: { label: string; onClick: () => void };
  description: React.ReactNode;
  title: string;
  variant: "default" | "destructive" | "success";
};

export type PendingActivityToast = {
  entry: ActivityEntry;
  id: string | number;
  reject: (reason?: ActivityToast) => void;
  resolve: (value: ActivityToast) => void;
};

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

function findPendingToast(
  entry: ActivityEntry,
  pendingToasts: Map<string, PendingActivityToast>,
): [string, PendingActivityToast] | undefined {
  const promiseKey = getPromiseKey(entry);
  const directMatch = pendingToasts.get(promiseKey);
  if (directMatch !== undefined) return [promiseKey, directMatch];
  if (!isExportActivity(entry) || entry.path === undefined) return undefined;

  for (const [key, pendingToast] of pendingToasts) {
    if (
      pendingToast.entry.kind === entry.kind &&
      pendingToast.entry.path === entry.path &&
      pendingToast.entry.snapshotId === entry.snapshotId
    ) {
      return [key, pendingToast];
    }
  }

  return undefined;
}

function getPromiseKey(entry: ActivityEntry): string {
  if (!isExportActivity(entry)) return entry.id;

  const attemptId = stringValue(entry.data?.attemptId);
  if (attemptId) return `activity:${entry.kind}:attempt:${attemptId}`;

  return `activity:${entry.kind}:source:${entry.snapshotId ?? ""}:${entry.path ?? entry.sourcePath ?? entry.id}`;
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

function isExportActivity(entry: ActivityEntry): boolean {
  return entry.kind === "fast-cut" || entry.kind === "render";
}

function createActivityToast(
  entry: ActivityEntry,
  instances: readonly EditingInstance[],
  t: TFunction,
  onAction: (action: NonNullable<ActivityEntry["action"]>) => void,
): ActivityToast {
  if (entry.kind === "workspace-restored") {
    const restored = numberValue(entry.data?.restoredSourceCount) ?? 0;
    const total = numberValue(entry.data?.sourceCount) ?? restored;
    const complete = restored === total;
    return {
      description: complete
        ? t("app.messages.workspaceRecovery.toastDescription", { count: restored })
        : t("app.messages.workspaceRecovery.toastPartialDescription", { restored, total }),
      title: complete
        ? t("app.messages.workspaceRecovery.toastTitle")
        : t("app.messages.workspaceRecovery.toastPartialTitle"),
      variant: "success",
    };
  }

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

function isToastable(status: ActivityStatus): boolean {
  return status !== "interrupted";
}

function stringValue(value: DiagnosticValue | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: DiagnosticValue | undefined): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export {
  createActivityToast,
  createDeferred,
  findPendingToast,
  getPromiseKey,
  getPromiseToastResult,
  getToastId,
  isExportActivity,
  isPromiseActivity,
  isToastable,
  showActivityToast,
};
