import { useMemo } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueueItem } from "@/app/store/slices/editing-instances-slice";
import { selectRunningExportMetrics } from "@/app/store/slices/export-slice";
import { cn } from "@/lib/class-names.utils";

import { ExportQueueItemContext } from "./contexts/ExportQueueItemContext";

function ExportQueueItem({
  attemptId,
  children,
  instanceId,
}: {
  attemptId: string;
  children: React.ReactNode;
  instanceId: string;
}) {
  const item = useAppSelector((state) => selectExportQueueItem(state, instanceId, attemptId));
  const runningMetrics = useAppSelector((state) =>
    selectRunningExportMetrics(state, instanceId, attemptId),
  );

  const itemWithRunningMetrics = useMemo(
    () =>
      item && runningMetrics
        ? {
            ...item,
            attempt: {
              ...item.attempt,
              metrics: { ...item.attempt.metrics, ...runningMetrics },
            },
          }
        : item,
    [item, runningMetrics],
  );

  if (!itemWithRunningMetrics) return null;

  return (
    <ExportQueueItemContext.Provider value={itemWithRunningMetrics}>
      {children}
    </ExportQueueItemContext.Provider>
  );
}

function ExportQueueItemContent({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <li className={cn("flex gap-3 p-1", className)}>{children}</li>;
}

export { ExportQueueItem, ExportQueueItemContent };
