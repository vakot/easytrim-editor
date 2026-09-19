import type { TFunction } from "i18next";
import { MoreHorizontal, Play, RotateCcw, Scissors, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectExportQueue,
  selectExportQueueById,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { selectQueueStarted } from "@/app/store/slices/export-slice";
import { selectImportedSourceThumbnails } from "@/app/store/slices/preview-slice";
import {
  cancelExportAndRequeueRequested,
  startExportQueue,
} from "@/app/store/thunks/export-thunks";
import {
  closeEditingInstancesRequested,
  prepareImportedSourceThumbnailsRequested,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance, ExportAttempt, ExportAttemptState } from "@/domain/editing-instance";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./components/DeleteSourceDialog";
import {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardStatusBadge,
  SourceCardThumbnail,
  SourceCardTitle,
} from "./components/SourceCard";

function SourceList() {
  const sources = usePrepareSources();

  return (
    <ScrollArea className="min-h-0 flex-1 pb-2">
      <ul className="flex flex-col gap-3 px-3 py-1" data-slot="imported-sources-grid">
        {sources.map((source) => (
          <SourceListItem key={source.id} source={source} />
        ))}
      </ul>
    </ScrollArea>
  );
}

function SourceListItem({ source }: { source: EditingInstance }) {
  return (
    <li className="flex w-full flex-col">
      <SourceListItemCard source={source} />
      <SourceListItemExtra source={source} />
    </li>
  );
}

function SourceListItemCard({ source }: { source: EditingInstance }) {
  const { t } = useTranslation();

  return (
    <SourceCard className="z-1 flex flex-row gap-2 p-2 hover:bg-card-foreground/10" source={source}>
      <SourceCardThumbnail className="w-6/11 shrink-0 rounded-md shadow">
        <SourceCardStatusBadge className="absolute top-2 left-2" />
      </SourceCardThumbnail>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1" data-slot="card-header">
          <SourceCardTitle className="line-clamp-2 wrap-break-word whitespace-normal" />
          <SourceCardDescription className="line-clamp-2 wrap-anywhere whitespace-normal" />
        </div>

        <SourceCardMetadata />

        <SourceCardActions className="invisible absolute right-0 bottom-0 transition-none group-hover/source-card:visible">
          <Button
            aria-label={`${t("source.actions.sourceActions")}: ${source.snapshot.source.displayName}`}
            className="transition-none"
            size="icon-sm"
            variant="secondary"
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </SourceCardActions>
      </div>
    </SourceCard>
  );
}

const sourceListItemExtraClassName = "min-h-8 border-t bg-muted/50 p-1 first:border-t-0";

function SourceListItemExtra({ source }: { source: EditingInstance }) {
  if (source.sourceAvailability !== "deleted" && source.exportAttempts.length === 0) return null;

  return (
    <div className="mt-px w-full px-3">
      <ul className="flex flex-col overflow-hidden rounded-b-lg border border-t-0">
        <SourceListItemExports sourceId={source.id} />
        <SourceListItemActions source={source} />
      </ul>
    </div>
  );
}

function SourceListItemExports({ sourceId }: { sourceId: string }) {
  const items = useAppSelector((state) => selectExportQueueById(state, sourceId));

  if (items.length === 0) return null;

  return (
    <li>
      <ul>
        {items.map(({ attempt }) => (
          <SourceListItemExport attempt={attempt} key={attempt.id} />
        ))}
      </ul>
    </li>
  );
}

function SourceListItemExport({ attempt }: { attempt: ExportAttempt }) {
  const { t } = useTranslation();

  const statusLabel = getExportQueueItemStatusLabel(t, attempt.state.status);

  return (
    <li className={sourceListItemExtraClassName}>
      <Button className="w-full min-w-0 justify-between gap-2" size="xs" variant="ghost">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {attempt.route === "fast" ? (
            <Scissors aria-hidden="true" className="shrink-0" />
          ) : (
            <Settings2 aria-hidden="true" className="shrink-0" />
          )}
          <span
            className="min-w-0 truncate text-xs text-muted-foreground"
            title={attempt.output.displayName}
          >
            {attempt.output.displayName}
          </span>
        </div>
        <Badge className="shrink-0 whitespace-nowrap" variant="outline">
          <span className={attempt.state.status === "rendering" ? "shimmer" : undefined}>
            {statusLabel}
          </span>
        </Badge>
      </Button>
    </li>
  );
}

function SourceListItemActions({ source }: { source: EditingInstance }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queueItems = useAppSelector(selectExportQueue);
  const items = useAppSelector((state) => selectExportQueueById(state, source.id));
  const queueStarted = useAppSelector(selectQueueStarted);

  const queueBusy =
    queueStarted ||
    queueItems.some(
      ({ attempt }) => attempt.state.status === "queued" || attempt.state.status === "rendering",
    );

  const hasRenderingExport = queueItems.some(({ attempt }) => attempt.state.status === "rendering");
  const queuedItems = items.filter(({ attempt }) => attempt.state.status === "queued");
  const renderingItem = items.find(({ attempt }) => attempt.state.status === "rendering");

  if (source.sourceAvailability === "deleted") {
    return (
      <li className={`${sourceListItemExtraClassName} flex gap-1`}>
        <Button
          onClick={() =>
            void dispatch(
              restoreSourceFileRequested({
                itemId: source.id,
                sourcePath: source.snapshot.source.sourcePath,
              }),
            )
          }
          size="xs"
          variant="success"
        >
          <RotateCcw aria-hidden="true" />
          {t("app.actions.restore")}
        </Button>
        <Button
          onClick={() => void dispatch(closeEditingInstancesRequested([source.id]))}
          size="xs"
          variant="ghost"
        >
          <X aria-hidden="true" />
          {t("app.actions.closeFile")}
        </Button>
      </li>
    );
  }

  if (renderingItem) {
    return (
      <li className={sourceListItemExtraClassName}>
        <Button
          onClick={() =>
            void dispatch(
              cancelExportAndRequeueRequested({
                attemptId: renderingItem.attempt.id,
                instanceId: renderingItem.instance.id,
              }),
            )
          }
          size="xs"
          variant="destructive"
        >
          <X aria-hidden="true" />
          {t("queue.actions.cancel")}
        </Button>
      </li>
    );
  }

  if (queuedItems.length > 0 && !queueStarted && !hasRenderingExport) {
    return (
      <li className={sourceListItemExtraClassName}>
        <Button
          onClick={() =>
            void dispatch(
              startExportQueue({ id: `source-list.start.${source.id}`, type: "button" }),
            )
          }
          size="xs"
        >
          <Play aria-hidden="true" />
          {t("queue.actions.start")}
        </Button>
      </li>
    );
  }

  if (queueBusy || items.length === 0) return null;

  return (
    <li className={sourceListItemExtraClassName}>
      <DeleteSourceDialog sourceId={source.id}>
        <DeleteSourceDialogTrigger asChild>
          <Button size="xs" variant="destructive">
            <Trash2 aria-hidden="true" />
            {t("app.actions.deleteFile")}
          </Button>
        </DeleteSourceDialogTrigger>
      </DeleteSourceDialog>
    </li>
  );
}

function usePrepareSources() {
  const dispatch = useAppDispatch();

  const instances = useAppSelector(selectImportedEditingInstances);
  const importedThumbnails = useAppSelector(selectImportedSourceThumbnails);
  const thumbnailRequestIds = useRef(new Set<string>());

  useEffect(() => {
    const instancesWithoutThumbnail = instances.filter(
      (instance) =>
        instance.sourceAvailability === "available" &&
        importedThumbnails[instance.id] === undefined &&
        !thumbnailRequestIds.current.has(instance.id),
    );

    if (instancesWithoutThumbnail.length === 0) return;

    for (const instance of instancesWithoutThumbnail) {
      thumbnailRequestIds.current.add(instance.id);
    }

    void dispatch(prepareImportedSourceThumbnailsRequested(instancesWithoutThumbnail));
  }, [dispatch, importedThumbnails, instances]);

  return instances;
}

function getExportQueueItemStatusLabel(t: TFunction, status: ExportAttemptState["status"]): string {
  switch (status) {
    case "completed":
      return t("source.status.completed");
    case "failed":
      return t("source.status.failed");
    case "canceled":
      return t("source.status.loading");
    case "rendering":
      return t("source.status.rendering");
    case "queued":
      return t("source.status.queued");
  }
}

export { SourceList };
