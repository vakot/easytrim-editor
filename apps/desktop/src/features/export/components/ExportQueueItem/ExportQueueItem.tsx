import { useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueueById } from "@/app/store/slices/editing-instances-slice";
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
  const item = useAppSelector((state) =>
    selectExportQueueById(state, instanceId).find(({ attempt }) => attempt.id === attemptId),
  );

  if (!item) return null;

  return <ExportQueueItemContext.Provider value={item}>{children}</ExportQueueItemContext.Provider>;
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
