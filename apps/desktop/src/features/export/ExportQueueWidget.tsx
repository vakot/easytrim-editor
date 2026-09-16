import { FileVideo, LoaderCircle, Play, X } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectExportQueue,
  selectQueuedExportCount,
} from "@/app/store/slices/editing-instances-slice";
import { selectQueueStarted } from "@/app/store/slices/export-slice";
import { selectImportedSourceThumbnail } from "@/app/store/slices/preview-slice";
import { cancelExportRequested, startExportQueue } from "@/app/store/thunks/export-thunks";
import type { EditingInstance, ExportAttempt } from "@/domain/editing-instance";
import { formatSourcePath } from "@/features/source";
import { cn } from "@/lib/class-names.utils";

interface ExportQueueWidgetProps {
  children: React.ReactNode;
  className?: string;
}

type ExportQueueItem = { attempt: ExportAttempt; instance: EditingInstance };

function ExportQueueWidget({ children, className }: ExportQueueWidgetProps) {
  return (
    <ExportQueueWidgetProvider>
      <div className={className}>{children}</div>
    </ExportQueueWidgetProvider>
  );
}

function ExportQueueWidgetActive({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();

  const { active: item } = useExportQueueWidgetData();
  const sourceName = item.instance.snapshot.source.displayName;

  const labels = {
    rendering: t("queue.accessibility.active", { name: sourceName }),
    pending: t("queue.accessibility.pending", { name: sourceName }),
  };

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <ExportQueueThumbnail
        alt={item.attempt.state.status === "rendering" ? labels.rendering : labels.pending}
        instanceId={item.instance.id}
      />

      {children}
    </div>
  );
}

function ExportQueueWidgetActiveDetails({ className }: { className?: string }) {
  const { t } = useTranslation();

  const { active: item } = useExportQueueWidgetData();
  const progress = Math.min(100, Math.max(0, Math.round(item.attempt.metrics.progressPercent)));
  const sourcePath = formatSourcePath(item.instance.snapshot.source.sourcePath);

  return (
    <div
      className={cn(
        "bg- absolute inset-0 flex flex-col gap-2 bg-background/30 p-2 shadow-[inset_0_0_96px_rgb(0_0_0)]",
        className,
      )}
    >
      <div className="relative">
        <div className="absolute top-0 right-0 flex gap-1">
          <ExportQueueItemStart />
          <ExportQueueItemCancel item={item} />
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 content-center gap-1 px-2">
        <p
          className="truncate font-heading text-sm leading-snug font-medium text-foreground"
          title={item.attempt.output.displayName}
        >
          {item.attempt.output.displayName}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={sourcePath}>
          {t("common.labels.from")}: {sourcePath}
        </p>
      </div>

      <div className="flex w-full min-w-0 shrink-0 items-center gap-2">
        <Progress
          aria-label={t("queue.accessibility.progress")}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="h-1.5 min-w-0 flex-1 bg-foreground/15"
          value={progress}
        />
        <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
          {progress}%
        </span>
      </div>
    </div>
  );
}

function ExportQueueWidgetPendingList({
  children,
  className,
}: {
  children?: React.ReactNode | (({ items }: { items: ExportQueueItem[] }) => React.ReactNode);
  className?: string;
}) {
  const { pending } = useExportQueueWidgetData();

  if (pending.length === 0) return null;

  const content =
    typeof children === "function"
      ? children({ items: pending })
      : (children ??
        pending.map((item) => <ExportQueueWidgetPendingItem item={item} key={item.attempt.id} />));

  return <ul className={className}>{content}</ul>;
}

function ExportQueueWidgetPendingListItems({ compact }: { compact?: boolean }) {
  const { pending } = useExportQueueWidgetData();

  return pending.map((item) => (
    <ExportQueueWidgetPendingItem compact={compact} item={item} key={item.attempt.id} />
  ));
}

function ExportQueueWidgetPendingListEmpty({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { pending } = useExportQueueWidgetData();

  if (pending.length !== 0) return null;

  return (
    <div
      className={cn(
        "grid place-items-center px-2 py-4 text-center text-xs text-muted-foreground",
        className,
      )}
    >
      {t("queue.messages.pendingEmpty")}
    </div>
  );
}

function ExportQueueWidgetPendingItem({
  compact,
  item,
}: {
  compact?: boolean;
  item: ExportQueueItem;
}) {
  const { t } = useTranslation();

  const sourceName = item.instance.snapshot.source.displayName;

  return (
    <li
      className={cn(
        "flex min-w-0 items-center gap-2 px-2 py-1 text-xs text-foreground/80",
        compact && "px-2 py-0.5",
      )}
    >
      <ExportQueueThumbnail
        alt={t("queue.accessibility.pending", { name: sourceName })}
        className={cn("size-10 shrink-0 rounded", compact && "size-8")}
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

function ExportQueueItemCancel({ compact, item }: { compact?: boolean; item: ExportQueueItem }) {
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
      size={compact ? "icon-2xs" : "icon-xs"}
      title={t("queue.actions.cancel")}
      type="button"
      variant="destructive"
    >
      <X aria-hidden="true" />
    </Button>
  );
}

function ExportQueueItemStart({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();

  const dispatch = useAppDispatch();
  const queuedExportCount = useAppSelector(selectQueuedExportCount);
  const queueStarted = useAppSelector(selectQueueStarted);

  return (
    <Button
      aria-label={t("queue.actions.start")}
      disabled={queuedExportCount === 0 || queueStarted}
      onClick={() => void dispatch(startExportQueue({ id: "queue.start", type: "button" }))}
      size={compact ? "icon-2xs" : "icon-xs"}
      title={t("queue.actions.start")}
      type="button"
    >
      <Play aria-hidden="true" />
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
    <div className={cn("relative size-full overflow-hidden bg-muted", className)}>
      {thumbnailUrl ? (
        <img alt={alt} className="size-full object-cover" src={thumbnailUrl} />
      ) : thumbnail?.status === "loading" ? (
        <span
          aria-label={t("source.status.loading")}
          className="absolute inset-0 grid place-items-center"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
        </span>
      ) : (
        <span className="absolute inset-0 grid place-items-center">
          <FileVideo aria-hidden="true" className="size-4 text-muted-foreground" />
        </span>
      )}
    </div>
  );
}

function ExportQueueWidgetProvider({ children }: { children?: React.ReactNode }) {
  const { active, pending } = useAppSelector(selectExportQueue);

  const featuredItem = active ?? pending[0];
  const pendingItems = active ? pending : pending.slice(1);

  if (!featuredItem) return null;

  return (
    <ExportQueueWidgetContext.Provider value={{ active: featuredItem, pending: pendingItems }}>
      {children}
    </ExportQueueWidgetContext.Provider>
  );
}

function useExportQueueWidgetData() {
  const context = React.useContext(ExportQueueWidgetContext);
  if (!context) {
    throw new Error(
      "useExportQueueWidgetData must be used within an ExportQueueWidgetProvider context.",
    );
  }
  return context;
}

const ExportQueueWidgetContext = React.createContext<{
  active: ExportQueueItem;
  pending: ExportQueueItem[];
} | null>(null);

export {
  ExportQueueWidget,
  ExportQueueWidgetActive,
  ExportQueueWidgetActiveDetails,
  ExportQueueWidgetPendingItem,
  ExportQueueWidgetPendingList,
  ExportQueueWidgetPendingListEmpty,
  ExportQueueWidgetPendingListItems,
};
