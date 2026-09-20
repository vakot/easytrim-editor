import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectEditingInstances } from "@/app/store/slices/editing-instances-slice";
import { restoreSourceFileRequested } from "@/app/store/thunks/source-media-thunks";
import { openFileLocation } from "@/lib/tauri/media";

import { useActivityFeed } from "../../../hooks/useActivityFeed";
import type { ActivityEntry } from "../../../lib/activity-projection";
import {
  createActivityToast,
  createDeferred,
  findPendingToast,
  getPromiseKey,
  getPromiseToastResult,
  getToastId,
  isPromiseActivity,
  isToastable,
  type PendingActivityToast,
  showActivityToast,
} from "../lib/activity-toast.utils";

function useActivityToasts() {
  const { currentSessionId, entries } = useActivityFeed();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const instances = useAppSelector(selectEditingInstances);
  const previousEntries = useRef<Map<string, ActivityEntry["status"]> | null>(null);
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
        const pendingToastMatch = findPendingToast(entry, pendingToasts.current);
        if (pendingToastMatch !== undefined) {
          const [pendingToastKey, pendingToast] = pendingToastMatch;
          toast.dismiss(pendingToast.id);
          pendingToasts.current.delete(pendingToastKey);
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
        const promiseKey = getPromiseKey(entry);
        if (!pendingToasts.current.has(promiseKey)) {
          const deferred = createDeferred<typeof activityToast>();
          const toastId = toast.promise(deferred.promise, {
            description: activityToast.description,
            error: (terminalToast) => getPromiseToastResult(terminalToast),
            id: promiseKey,
            loading: activityToast.title,
            success: (terminalToast) => getPromiseToastResult(terminalToast),
          });

          const resolvedToastId = getToastId(toastId);
          if (resolvedToastId !== undefined) {
            pendingToasts.current.set(promiseKey, {
              entry,
              id: resolvedToastId,
              reject: deferred.reject,
              resolve: deferred.resolve,
            });
          }
        }
        continue;
      }

      const pendingToastMatch = findPendingToast(entry, pendingToasts.current);
      if (pendingToastMatch === undefined) {
        showActivityToast(
          activityToast,
          isPromiseActivity(entry) ? getPromiseKey(entry) : undefined,
        );
        continue;
      }

      const [pendingToastKey, pendingToast] = pendingToastMatch;
      pendingToasts.current.delete(pendingToastKey);
      if (entry.status === "cancelled") {
        pendingToast.resolve(activityToast);
        setTimeout(() => showActivityToast(activityToast, pendingToast.id), 0);
      } else if (entry.status === "failed") {
        pendingToast.reject(activityToast);
        showActivityToast(activityToast, pendingToast.id);
      } else {
        pendingToast.resolve(activityToast);
        showActivityToast(activityToast, pendingToast.id);
      }
    }

    previousEntries.current = next;
  }, [currentSessionId, dispatch, entries, instances, t]);
}

export { useActivityToasts };
