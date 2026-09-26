import { cn } from "@/lib/class-names.utils";

import { useExportQueue } from "../contexts/ExportQueueContext";

import { ExportQueueItem } from "./ExportQueueItem";

function ExportQueueContent({ className }: { className?: string }) {
  const { queue } = useExportQueue();

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {queue.map((item) => (
        <ExportQueueItem
          attemptId={item.attempt.id}
          instanceId={item.instance.id}
          key={item.attempt.id}
        />
      ))}
    </ul>
  );
}

export { ExportQueueContent };
