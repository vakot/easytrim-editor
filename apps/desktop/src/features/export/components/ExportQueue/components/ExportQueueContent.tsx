import { Film } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { cn } from "@/lib/class-names.utils";

import {
  ExportQueueItem,
  ExportQueueItemCancel,
  ExportQueueItemContent,
  ExportQueueItemMetrics,
  ExportQueueItemOutputName,
  ExportQueueItemProgressBar,
  ExportQueueItemProgressPercent,
  ExportQueueItemRestore,
  ExportQueueItemRetry,
  ExportQueueItemReveal,
  ExportQueueItemRoute,
  ExportQueueItemSourceName,
  ExportQueueItemStatus,
  useExportQueueItem,
} from "../../ExportQueueItem";
import { useExportQueue } from "../contexts/ExportQueueContext";

import { ExportQueueEmpty } from "./ExportQueueEmpty";

function ExportQueueContent({ className }: { className?: string }) {
  const { queue } = useExportQueue();

  if (!queue.length) return <ExportQueueEmpty />;

  return (
    <ul className={cn("flex w-full flex-col", className)}>
      {queue.map((item, index) => (
        <ExportQueueItem
          attemptId={item.attempt.id}
          instanceId={item.instance.id}
          key={item.attempt.id}
        >
          <ExportQueueListItem />
          {index < queue.length - 1 ? (
            <li aria-hidden="true" className="px-1">
              <Separator />
            </li>
          ) : null}
        </ExportQueueItem>
      ))}
    </ul>
  );
}

function ExportQueueListItem() {
  const { attempt } = useExportQueueItem();

  const status = attempt.state.status;

  return (
    <ExportQueueItemContent className="text-xs">
      <Card className="size-10 shrink-0 items-center justify-center p-0" size="sm">
        <Film className="size-6 text-muted-foreground" />
      </Card>

      <div className="grid flex-1 gap-1">
        <div className="flex justify-between gap-2">
          <div className="grid min-w-0 gap-1">
            <ExportQueueItemOutputName />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ExportQueueItemSourceName />
              ·
              <ExportQueueItemRoute />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ExportQueueItemStatus />
            <ExportQueueItemCancel />
            <ExportQueueItemRestore />
          </div>
        </div>

        {status === "rendering" && <ExportQueueItemProgressBar />}

        <ExportQueueItemDetails />

        <div className="flex gap-1">
          <ExportQueueItemRetry />
          <ExportQueueItemReveal />
        </div>
      </div>
    </ExportQueueItemContent>
  );
}

function ExportQueueItemDetails() {
  const { attempt } = useExportQueueItem();
  const { metrics, state } = attempt;

  const hasDetails =
    state.status !== "queued" &&
    (state.status === "rendering" ||
      state.status === "completed" ||
      metrics.progressPercent > 0 ||
      metrics.durationMs !== null ||
      metrics.fileSizeBytes !== undefined ||
      metrics.fps !== undefined);

  if (!hasDetails) return null;

  return (
    <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
      <ExportQueueItemProgressPercent />
      <ExportQueueItemMetrics />
    </div>
  );
}

export { ExportQueueContent };
