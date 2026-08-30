import { Check, ExternalLink, RotateCcw, Trash, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { type ExportQueueItem, selectExportQueue } from "@/app/store/slices/export-slice";
import {
  cancelExportRequested,
  restoreExportQueueItemRequested,
} from "@/app/store/thunks/export-thunks";
import { editorSnapshotTrimStart } from "@/domain/editor-snapshot";
import { cn } from "@/lib/class-names.utils";
import { openFileLocation, restoreSourceFromTrash } from "@/lib/tauri/media";

const statusStyles = {
  rendering: "border-l-primary",
  queued: "border-l-muted-foreground",
  completed: "border-l-emerald-400",
  failed: "border-l-destructive",
  canceled: "border-l-destructive",
} as const;

export function ExportQueue() {
  const { t } = useTranslation();
  const queue = useAppSelector(selectExportQueue);
  const [now, setNow] = useState(() => Date.now());
  const hasRenderingItem = queue.some((item) => item.status === "rendering");

  useEffect(() => {
    if (!hasRenderingItem) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [hasRenderingItem]);

  return (
    <section aria-labelledby="export-queue-title">
      <h2 className="sr-only" id="export-queue-title">
        {t("queue.labels.export")}
      </h2>

      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {t("common.status.empty")}
        </p>
      ) : (
        <div aria-live="polite" className="grid gap-2 pb-2" role="status">
          {queue.map((item) => (
            <ExportQueueItem item={item} key={item.id} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}

interface ExportQueueItemProps {
  item: ExportQueueItem;
  now?: number;
}

function ExportQueueItem({ item, now }: ExportQueueItemProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const timeline = useTimeline();
  const isSourceDeleted = item.sourceDeleted === true;

  async function restoreItem() {
    const restored = await dispatch(restoreExportQueueItemRequested(item.id));
    if (restored) timeline.onSeek(editorSnapshotTrimStart(item.snapshot.trim));
  }

  return (
    <Card
      aria-label={
        isSourceDeleted
          ? undefined
          : t("queue.accessibility.restoreItem", { filename: item.filename })
      }
      className={cn(
        "border-l-4 ring-inset",
        !isSourceDeleted && "transition-colors hover:bg-muted/60",
        statusStyles[item.status],
      )}
      onClick={isSourceDeleted ? undefined : () => void restoreItem()}
      size="sm"
    >
      <CardHeader>
        <CardTitle className="truncate">{item.filename}</CardTitle>
        <CardDescription className="truncate">
          <ExportQueueItemStatus item={item} now={now} />
          {item.path}
        </CardDescription>
        <CardAction>
          <ExportQueueItemAction item={item} />
        </CardAction>
      </CardHeader>

      <ExportQueueItemSourceDeleted item={item} />
      <ExportQueueItemError item={item} />
    </Card>
  );
}

function ExportQueueItemSourceDeleted({ item }: ExportQueueItemProps) {
  const { t } = useTranslation();
  const [isRestored, setIsRestored] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const isSourceDeleted = item.sourceDeleted === true;

  async function restoreSource() {
    setIsRestoring(true);
    try {
      await restoreSourceFromTrash(item.snapshot.source.sourcePath);
      setIsRestored(true);
    } catch {
      setIsRestored(false);
    } finally {
      setIsRestoring(false);
    }
  }

  if (!isSourceDeleted) return null;

  return (
    <CardFooter className="flex justify-between gap-2 py-1 text-xs">
      <span className="flex gap-2">
        <Trash aria-hidden="true" className="size-3.5" />
        {isRestored ? "Source restored" : t("queue.status.sourceDeleted")}
      </span>
      <Button
        disabled={isRestored || isRestoring}
        onClick={(event) => {
          event.stopPropagation();
          void restoreSource();
        }}
        size="xs"
        variant="success"
      >
        {isRestored ? <Check /> : <RotateCcw />}
        Restore
      </Button>
    </CardFooter>
  );
}

function ExportQueueItemError({ item }: ExportQueueItemProps) {
  if (!item.error || item.status === "canceled") return null;
  return <CardFooter className="py-2 text-xs text-destructive">{item.error}</CardFooter>;
}

function ExportQueueItemAction({ item }: ExportQueueItemProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const isCompleted = item.status === "completed";

  const openLocation = () => {
    if (isCompleted) void openFileLocation(item.path).catch(() => undefined);
  };

  if (item.status === "queued" || item.status === "rendering") {
    return (
      <Button
        aria-label={t("queue.accessibility.cancelItem", { filename: item.filename })}
        onClick={(event) => {
          event.stopPropagation();
          dispatch(cancelExportRequested(item.id));
        }}
        size="icon"
        variant="destructive"
      >
        <X />
      </Button>
    );
  }

  if (item.status === "completed") {
    return (
      <Button
        aria-label={t("queue.accessibility.openLocation", {
          filename: item.filename,
        })}
        onClick={(event) => {
          event.stopPropagation();
          openLocation();
        }}
        size="icon"
        variant="ghost"
      >
        <ExternalLink />
      </Button>
    );
  }

  return null;
}

function ExportQueueItemStatus({ item, now = 0 }: ExportQueueItemProps) {
  const { t } = useTranslation();

  const durationMs =
    item.status === "rendering" && item.startedAt ? now - item.startedAt : item.durationMs;

  const statusLabel =
    item.status === "rendering" || item.status === "completed"
      ? formatDuration(durationMs ?? 0)
      : item.status === "failed"
        ? t("queue.status.failed")
        : item.status === "canceled"
          ? t("queue.status.canceled")
          : t("queue.status.queued");

  return (
    <span
      className={cn(
        "shrink-0 text-primary",
        (item.status === "failed" || item.status === "canceled") && "text-destructive",
        item.status === "completed" && "text-emerald-400",
      )}
    >
      {item.status === "rendering" || item.status === "completed" ? (
        <span className="inline-grid text-right whitespace-nowrap tabular-nums">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">
            {durationPlaceholder(statusLabel)}
          </span>
          <span className="col-start-1 row-start-1">{statusLabel}</span>
        </span>
      ) : (
        statusLabel
      )}{" "}
      ·{" "}
    </span>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function durationPlaceholder(label: string) {
  return label.replace(/\d/g, "0");
}
