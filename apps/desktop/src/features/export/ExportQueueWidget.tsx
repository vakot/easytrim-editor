import { FileVideo, LoaderCircle, X } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueue } from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourceThumbnail } from "@/app/store/slices/preview-slice";
import { cancelExportRequested } from "@/app/store/thunks/export-thunks";
import {
  createExportAttempt,
  type EditingInstance,
  type ExportAttempt,
} from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";

interface ExportQueueWidgetProps {
  children: React.ReactNode;
  className?: string;
}

type ExportQueueItem = { attempt: ExportAttempt; instance: EditingInstance };

// TEMP: replace with selectExportQueue once the live layout testing is complete.
const TEMPORARY_MOCK_EXPORT_QUEUE = {
  active: createMockQueueItem({
    capturedAt: 1,
    displayName: "mock-active-source.mp4",
    id: "mock-active",
    status: "rendering",
  }),
  pending: [
    createMockQueueItem({
      capturedAt: 2,
      displayName: "mock-pending-one.mov",
      id: "mock-pending-one",
      status: "queued",
    }),
    createMockQueueItem({
      capturedAt: 3,
      displayName: "mock-pending-two.webm",
      id: "mock-pending-two",
      status: "queued",
    }),
    createMockQueueItem({
      capturedAt: 4,
      displayName: "mock-pending-four.mp4",
      id: "mock-pending-four",
      status: "queued",
    }),
    createMockQueueItem({
      capturedAt: 5,
      displayName: "mock-pending-five.mp4",
      id: "mock-pending-five",
      status: "queued",
    }),
    createMockQueueItem({
      capturedAt: 6,
      displayName: "mock-pending-six.mp4",
      id: "mock-pending-six",
      status: "queued",
    }),
  ],
} satisfies { active: ExportQueueItem; pending: ExportQueueItem[] };

function ExportQueueWidget({ children, className }: ExportQueueWidgetProps) {
  return (
    <ExportQueueWidgetProvider>
      <div className={className}>{children}</div>
    </ExportQueueWidgetProvider>
  );
}

function createMockQueueItem({
  capturedAt,
  displayName,
  id,
  status,
}: {
  capturedAt: number;
  displayName: string;
  id: string;
  status: "queued" | "rendering";
}): ExportQueueItem {
  const sourcePath = `C:/Mock/${displayName}`;
  const snapshot = createDefaultEditorSnapshot({ displayName, sourcePath }, false);
  const instance: EditingInstance = {
    exportAttempts: [],
    id: `instance-${id}`,
    origin: "source-import",
    snapshot,
    sourceAvailability: "available",
  };

  const queuedAttempt = createExportAttempt({
    capturedAt,
    id: `attempt-${id}`,
    output: {
      displayName: `export-${displayName}`,
      displayPath: `C:/Mock/Exports/export-${displayName}`,
      outputId: `output-${id}`,
    },
    request: {
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0,
      sourcePath,
      trim: { endMicros: 12_000_000, startMicros: 0 },
    },
    route: "optimized",
    snapshot,
    totalFrames: 288,
  });

  return {
    attempt:
      status === "rendering"
        ? {
            ...queuedAttempt,
            metrics: { ...queuedAttempt.metrics, progressPercent: 64 },
            state: { operationId: "mock-operation", startedAt: capturedAt, status },
          }
        : queuedAttempt,
    instance,
  };
}

function ExportQueueWidgetActive({ className }: { className?: string }) {
  const { t } = useTranslation();

  const { active: item } = useExportQueueWidgetData();
  const progress = Math.min(100, Math.max(0, Math.round(item.attempt.metrics.progressPercent)));
  const sourceName = item.instance.snapshot.source.displayName;

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
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

function ExportQueueWidgetPendingList({
  className,
  render,
}: {
  className?: string;
  render?: () => React.ReactNode;
}) {
  const { pending } = useExportQueueWidgetData();

  if (pending.length === 0) return null;

  return (
    <ul className={className}>
      {pending.map((item) =>
        render ? render() : <ExportQueueWidgetPendingItem item={item} key={item.attempt.id} />,
      )}
    </ul>
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
        "flex min-w-0 items-center gap-2 p-2 text-xs text-foreground/80",
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

function useExportQueue(mocked: boolean = false) {
  const queue = useAppSelector(selectExportQueue);
  if (mocked) return TEMPORARY_MOCK_EXPORT_QUEUE;
  return queue;
}

function ExportQueueWidgetProvider({ children }: { children?: React.ReactNode }) {
  const { active, pending } = useExportQueue(true);

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
  ExportQueueWidgetPendingItem,
  ExportQueueWidgetPendingList,
};
