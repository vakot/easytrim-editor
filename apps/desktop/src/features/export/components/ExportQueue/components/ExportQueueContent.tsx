import { AudioLines, Film } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { cn } from "@/lib/class-names.utils";

import {
  ExportQueueItem,
  ExportQueueItemCancel,
  ExportQueueItemContent,
  ExportQueueItemEdit,
  ExportQueueItemMetrics,
  ExportQueueItemOutputName,
  ExportQueueItemProgressBar,
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
    <ul className={cn("flex w-full flex-col gap-2", className)}>
      {queue.map((item, index) => (
        <ExportQueueItem
          attemptId={item.attempt.id}
          instanceId={item.instance.id}
          key={item.attempt.id}
        >
          <ExportQueueListItem />
          {index < queue.length - 1 ? (
            <li aria-hidden="true">
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
  const Icon = attempt.route === "audio" ? AudioLines : Film;

  return (
    <ExportQueueItemContent className="text-xs">
      <Card className="size-10 shrink-0 items-center justify-center bg-primary/5 p-0 ring-primary/10">
        <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
      </Card>

      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex justify-between gap-2">
          <div className="grid min-w-0 gap-1">
            <div className="flex min-w-0 items-center gap-1">
              <ExportQueueItemOutputName className="min-w-0" />
              <ExportQueueItemEdit className="shrink-0" />
            </div>
            <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <ExportQueueItemSourceName className="min-w-0" />
              ·
              <ExportQueueItemRoute className="shrink-0" />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ExportQueueItemStatus />
            <ExportQueueItemCancel />
            <ExportQueueItemRestore />
          </div>
        </div>

        {status === "rendering" && <ExportQueueItemProgressBar />}

        <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <ExportQueueItemMetrics />
        </div>

        {status === "completed" || status === "failed" ? (
          <div className="flex gap-1">
            <ExportQueueItemReveal />
            <ExportQueueItemRetry />
          </div>
        ) : null}
      </div>
    </ExportQueueItemContent>
  );
}

export { ExportQueueContent };
