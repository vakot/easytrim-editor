import { Check, CircleX, ExternalLink, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useTimeline } from "@/app/hooks/useEditorContracts";
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import { type ExportQueueItem, selectExportQueue } from "@/app/store/slices/export-slice";
import {
  cancelExportRequested,
  restoreExportQueueItemRequested,
} from "@/app/store/thunks/export-thunks";
import { Button } from "@/components/ui/button";
import { editorSnapshotTrimStart } from "@/domain/editor-snapshot";
import { openFileLocation } from "@/lib/tauri/media";
import { cn } from "@/lib/utils";

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
    <section className="grid gap-3" aria-labelledby="export-queue-title">
      <div className="flex items-center justify-between">
        <h2
          id="export-queue-title"
          className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        >
          {t("export.queue")}
        </h2>
        <span className="text-xs text-muted-foreground">{queue.length}</span>
      </div>
      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {t("export.empty")}
        </p>
      ) : (
        <div className="grid gap-2" role="status" aria-live="polite">
          {queue.map((item) => (
            <ExportQueueItem key={item.id} item={item} now={now} />
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
        ? t("export.status.failure")
        : t(`export.status.${item.status}`);

  function openLocation() {
    if (isCompleted) void openFileLocation(item.path).catch(() => undefined);
  }

  async function restoreItem() {
    const restored = await dispatch(restoreExportQueueItemRequested(item.id));
    if (restored) timeline.onSeek(editorSnapshotTrimStart(item.snapshot.trim));
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border border-l-4 bg-card p-3",
        statusStyles[item.status],
        "transition-colors hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        className="min-w-0 cursor-pointer text-left"
        aria-label={t("export.restoreItem", { filename: item.filename })}
        onClick={() => void restoreItem()}
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
              <span className="inline-grid whitespace-nowrap text-right tabular-nums">
                <span className="invisible col-start-1 row-start-1" aria-hidden="true">
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
            variant="destructive"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              dispatch(cancelExportRequested(item.id));
            }}
            aria-label={t("export.cancelItem", { filename: item.filename })}
          >
            <X />
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            {item.status === "completed" ? (
              <>
                <span
                  className="grid size-7 place-items-center"
                  aria-label={t("export.statusLabel", {
                    status: t(`export.status.${item.status}`),
                  })}
                >
                  <Check className="size-4 text-emerald-400" />
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    openLocation();
                  }}
                  aria-label={t("export.openLocation", { filename: item.filename })}
                >
                  <ExternalLink />
                </Button>
              </>
            ) : item.status === "failed" ? (
              <span
                className="grid size-7 place-items-center"
                aria-label={t("export.statusLabel", {
                  status: t(`export.status.${item.status}`),
                })}
              >
                <TriangleAlert className="size-4 text-destructive" />
              </span>
            ) : (
              <span
                className="grid size-7 place-items-center"
                aria-label={t("export.statusLabel", {
                  status: t(`export.status.${item.status}`),
                })}
              >
                <CircleX className="size-4 text-destructive" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
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
