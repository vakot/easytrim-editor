import { FileVideo, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectExportQueue,
  type selectRenderingAttempt,
} from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourceThumbnail } from "@/app/store/slices/preview-slice";
import { cancelExportRequested } from "@/app/store/thunks/export-thunks";
import { cn } from "@/lib/class-names.utils";

interface ExportQueueWidgetProps {
  className?: string;
  layout?: "horizontal" | "vertical";
}

type ExportQueueItem = Exclude<ReturnType<typeof selectRenderingAttempt>, undefined>;

export function ExportQueueWidget({ className, layout = "horizontal" }: ExportQueueWidgetProps) {
  const { t } = useTranslation();
  const { active, pending } = useAppSelector(selectExportQueue);
  const vertical = layout === "vertical";
  const featuredItem = active ?? pending[0];
  const pendingItems = active ? pending : pending.slice(1);

  if (!featuredItem) return null;

  return (
    <div className={cn("flex min-h-0", vertical ? "flex-col" : "flex-row", className)}>
      <ExportQueueActiveItem
        className={vertical ? undefined : "h-full min-w-48 flex-1"}
        item={featuredItem}
      />
      {pendingItems.length > 0 ? (
        <ScrollArea
          className={cn("min-h-0 min-w-48 flex-1", !vertical && "aspect-video")}
          type="always"
        >
          <ul aria-label={t("app.labels.exportQueue")} className="grid gap-1">
            {pendingItems.map((item) => (
              <ExportQueuePendingItem item={item} key={item.attempt.id} />
            ))}
          </ul>
        </ScrollArea>
      ) : null}
    </div>
  );
}

function ExportQueueActiveItem({ className, item }: { className?: string; item: ExportQueueItem }) {
  const { t } = useTranslation();
  const progress = Math.min(100, Math.max(0, Math.round(item.attempt.metrics.progressPercent)));
  const sourceName = item.instance.snapshot.source.displayName;

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden border border-foreground/10 bg-muted",
        className,
      )}
    >
      <ExportQueueThumbnail
        alt={t(
          item.attempt.state.status === "rendering"
            ? "queue.accessibility.active"
            : "queue.accessibility.pending",
          { name: sourceName },
        )}
        instanceId={item.instance.id}
      />
      <div className="absolute inset-x-0 bottom-0 grid gap-2 bg-background/85 p-2 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground" title={sourceName}>
            {sourceName}
          </p>
          <p
            className="truncate text-[10px] text-muted-foreground"
            title={item.attempt.output.displayName}
          >
            {item.attempt.output.displayName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Progress
            aria-label={t("queue.accessibility.progress")}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="h-1.5"
            value={progress}
          />
          <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
            {progress}%
          </span>

          <ExportQueueItemCancel item={item} />
        </div>
      </div>
    </div>
  );
}

function ExportQueuePendingItem({ item }: { item: ExportQueueItem }) {
  const { t } = useTranslation();
  const sourceName = item.instance.snapshot.source.displayName;

  return (
    <li className="flex min-w-0 items-center gap-2 p-1 text-xs text-foreground/80">
      <ExportQueueThumbnail
        alt={t("queue.accessibility.pending", { name: sourceName })}
        className="size-10 shrink-0 rounded"
        instanceId={item.instance.id}
      />

      <div className="min-w-0 flex-1">
        <span className="block truncate" title={item.attempt.output.displayName}>
          {item.attempt.output.displayName}
        </span>
        <span className="block truncate text-muted-foreground" title={sourceName}>
          {sourceName}
        </span>
      </div>

      <ExportQueueItemCancel item={item} />
    </li>
  );
}

function ExportQueueItemCancel({ item }: { item: ExportQueueItem }) {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();

  const sourceName = item.instance.snapshot.source.displayName;

  return (
    <Button
      aria-label={`${t("queue.actions.cancel")}: ${sourceName}`}
      onClick={() =>
        void dispatch(
          cancelExportRequested({ attemptId: item.attempt.id, instanceId: item.instance.id }),
        )
      }
      size="icon-2xs"
      title={t("queue.actions.cancel")}
      type="button"
      variant="destructive"
    >
      <X aria-hidden="true" />
    </Button>
  );
}

function ExportQueueThumbnail({
  alt,
  className,
  instanceId,
}: {
  alt: string;
  className?: string;
  instanceId: string;
}) {
  const { t } = useTranslation();
  const thumbnail = useAppSelector((state) => selectImportedSourceThumbnail(state, instanceId));
  const thumbnailUrl = thumbnail?.status === "ready" ? thumbnail.value.url : undefined;

  return (
    <div className={cn("relative aspect-video overflow-hidden bg-muted", className)}>
      {thumbnailUrl ? (
        <img alt={alt} className="size-full object-cover" src={thumbnailUrl} />
      ) : thumbnail?.status === "loading" ? (
        <span aria-label={t("source.status.loading")} className="grid size-full place-items-center">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
        </span>
      ) : (
        <span className="grid size-full place-items-center">
          <FileVideo aria-hidden="true" className="size-4 text-muted-foreground" />
        </span>
      )}
    </div>
  );
}
