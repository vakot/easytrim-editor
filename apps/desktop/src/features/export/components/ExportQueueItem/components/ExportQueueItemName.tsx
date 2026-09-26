import { cn } from "@/lib/class-names.utils";

import { useExportQueueItem } from "../contexts/ExportQueueItemContext";

function ExportQueueItemSourceName({ className }: { className?: string }) {
  const { instance } = useExportQueueItem();

  const source = instance.snapshot.source;

  return (
    <p className={cn("truncate", className)} title={source.sourcePath}>
      {source.displayName}
    </p>
  );
}

function ExportQueueItemOutputName({ className }: { className?: string }) {
  const { attempt } = useExportQueueItem();

  return (
    <p className={cn("truncate", className)} title={attempt.output.displayPath}>
      {attempt.output.displayName}
    </p>
  );
}

export { ExportQueueItemOutputName, ExportQueueItemSourceName };
