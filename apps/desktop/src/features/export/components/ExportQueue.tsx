import { Check, CircleX, Link2, LoaderCircle, TriangleAlert, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openFileLocation } from "@/lib/tauri/media";

import type { ExportToast } from "../types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const statusStyles = {
  rendering: "border-l-primary",
  queued: "border-l-muted-foreground",
  completed: "border-l-emerald-400",
  failed: "border-l-destructive",
  canceled: "border-l-destructive",
} as const;

export function ExportQueue({ queue }: { queue: ExportToast[] }) {
  const { t } = useTranslation();
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

function ExportQueueItem({ item, now }: { item: ExportToast; now: number }) {
  const { t } = useTranslation();
  const isCompleted = item.status === "completed";
  const statusLabel =
    item.status === "rendering" ? `${item.percentage}%` : t(`export.status.${item.status}`);
  const durationMs =
    item.status === "rendering" && item.startedAt ? now - item.startedAt : item.durationMs;

  function openLocation() {
    if (isCompleted) void openFileLocation(item.path).catch(() => undefined);
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border border-l-4 bg-card p-3",
        statusStyles[item.status],
        isCompleted && "cursor-pointer transition-colors hover:bg-muted/60",
      )}
      role={isCompleted ? "button" : undefined}
      tabIndex={isCompleted ? 0 : undefined}
      onClick={openLocation}
      onKeyDown={(event) => {
        if (isCompleted && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          openLocation();
        }
      }}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
          <strong className="truncate">{item.filename}</strong>
          <span
            className={cn(
              "shrink-0 text-primary",
              (item.status === "failed" || item.status === "canceled") && "text-destructive",
              item.status === "completed" && "text-emerald-400",
            )}
          >
            · {statusLabel}
            {durationMs !== null ? ` · ${formatDuration(durationMs)}` : null}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{item.path}</p>
        {item.error && item.status !== "canceled" ? (
          <p className="mt-1 text-xs text-destructive">{item.error}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        {isCompleted ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              openLocation();
            }}
            aria-label={t("export.openLocation")}
          >
            <Link2 />
          </Button>
        ) : null}
        {item.onCancel ? (
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              item.onCancel?.();
            }}
            aria-label={t("export.cancelItem", { filename: item.filename })}
          >
            <X />
          </Button>
        ) : (
          <span
            className="grid size-7 place-items-center"
            aria-label={t("export.statusLabel", { status: t(`export.status.${item.status}`) })}
          >
            {item.status === "completed" ? (
              <Check className="size-4 text-emerald-400" />
            ) : item.status === "failed" ? (
              <TriangleAlert className="size-4 text-destructive" />
            ) : item.status === "rendering" ? (
              <LoaderCircle className="size-4 animate-spin text-primary" />
            ) : item.status === "queued" ? (
              <span className="size-2 rounded-full bg-muted-foreground" />
            ) : (
              <CircleX className="size-4 text-destructive" />
            )}
          </span>
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
