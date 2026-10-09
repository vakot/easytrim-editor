import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ExportQueueItemRouteIcon,
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

  return (
    <ExportQueueItemContent className="text-xs">
      <Card className="size-10 shrink-0 items-center justify-center bg-primary/5 p-0 ring-primary/10">
        <ExportQueueItemRouteIcon className="size-6 text-muted-foreground" route={attempt.route} />
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

          <ExportQueueItemStatus />
        </div>

        {status === "rendering" && <ExportQueueItemProgressBar />}

        <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <ExportQueueItemMetrics />
        </div>

        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <ExportQueueItemReveal />
            <ExportQueueItemRetry />
            <ExportQueueItemCancel />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreVertical aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
              <DropdownMenuGroup>
                <ExportQueueItemRestore asMenuItem />
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <ExportQueueItemEdit asMenuItem />
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </ExportQueueItemContent>
  );
}

export { ExportQueueContent };
