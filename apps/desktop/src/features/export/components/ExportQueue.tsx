import { Check, CircleX, ExternalLink, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { type ExportQueueItem, selectExportQueue } from "@/app/store/slices/export-slice";
import {
  cancelExportRequested,
  restoreExportQueueItemRequested,
} from "@/app/store/thunks/export-thunks";
import { editorSnapshotTrimStart } from "@/domain/editor-snapshot";
import { cn } from "@/lib/class-names.utils";
import { openFileLocation } from "@/lib/tauri/media";

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
        <div aria-live="polite" className="grid gap-2" role="status">
          {queue.map((item) => (
            <ExportQueueItem item={item} key={item.id} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}

function ExportQueueItem({ item, now }: { item: ExportQueueItem; now: number }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const timeline = useTimeline();
  const isCompleted = item.status === "completed";
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

  function openLocation() {
    if (isCompleted) void openFileLocation(item.path).catch(() => undefined);
  }

  async function restoreItem() {
    const restored = await dispatch(restoreExportQueueItemRequested(item.id));
    if (restored) timeline.onSeek(editorSnapshotTrimStart(item.snapshot.trim));
  }

  return (
    <Card
      className={cn(
        "flex-row items-center gap-2 border-l-4 p-2 ring-inset",
        statusStyles[item.status],
        "transition-colors hover:bg-muted/60",
      )}
    >
      <button
        aria-label={t("queue.accessibility.restoreItem", { filename: item.filename })}
        className="min-w-0 cursor-pointer text-left"
        onClick={() => void restoreItem()}
        type="button"
      >
        <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
          <strong className="truncate">{item.filename}</strong>
          <span
            className={cn(
              "shrink-0 text-primary",
              (item.status === "failed" || item.status === "canceled") && "text-destructive",
              item.status === "completed" && "text-emerald-400",
            )}
          >
            ·{" "}
            {item.status === "rendering" || item.status === "completed" ? (
              <span className="inline-grid text-right whitespace-nowrap tabular-nums">
                <span aria-hidden="true" className="invisible col-start-1 row-start-1">
                  {durationPlaceholder(statusLabel)}
                </span>
                <span className="col-start-1 row-start-1">{statusLabel}</span>
              </span>
            ) : (
              statusLabel
            )}
          </span>
        </div>
        <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">{item.path}</span>
        </p>
        {item.error && item.status !== "canceled" ? (
          <p className="mt-1 text-xs text-destructive">{item.error}</p>
        ) : null}
      </button>
      <div className="flex items-center gap-1">
        {item.status === "queued" || item.status === "rendering" ? (
          <Button
            aria-label={t("queue.accessibility.cancelItem", { filename: item.filename })}
            onClick={(event) => {
              event.stopPropagation();
              dispatch(cancelExportRequested(item.id));
            }}
            size="icon-sm"
            variant="destructive"
          >
            <X />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            {item.status === "completed" ? (
              <>
                <span
                  aria-label={t("queue.accessibility.status", {
                    status: t("queue.status.completed"),
                  })}
                  className="grid size-7 place-items-center"
                >
                  <Check className="size-4 text-emerald-400" />
                </span>
                <Button
                  aria-label={t("queue.accessibility.openLocation", {
                    filename: item.filename,
                  })}
                  onClick={(event) => {
                    event.stopPropagation();
                    openLocation();
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <ExternalLink />
                </Button>
              </>
            ) : item.status === "failed" ? (
              <span
                aria-label={t("queue.accessibility.status", {
                  status: t("queue.status.failed"),
                })}
                className="grid size-7 place-items-center"
              >
                <TriangleAlert className="size-4 text-destructive" />
              </span>
            ) : (
              <span
                aria-label={t("queue.accessibility.status", {
                  status: t("queue.status.canceled"),
                })}
                className="grid size-7 place-items-center"
              >
                <CircleX className="size-4 text-destructive" />
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
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
