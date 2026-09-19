import { MoreHorizontal, Play, RotateCcw, Scissors, Settings2, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectExportQueue,
  selectImportedEditingInstances,
} from "@/app/store/slices/editing-instances-slice";
import { selectQueueStarted } from "@/app/store/slices/export-slice";
import { selectImportedSourceThumbnails } from "@/app/store/slices/preview-slice";
import { startExportQueue } from "@/app/store/thunks/export-thunks";
import {
  prepareImportedSourceThumbnailsRequested,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance, ExportAttempt } from "@/domain/editing-instance";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./components/DeleteSourceDialog";
import {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
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
      <SourceCardThumbnail className="w-6/11 shrink-0 rounded-md shadow" />

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

const sourceListItemExtraClassName =
  "min-h-8 border-t bg-muted/50 p-1 first:border-t-0 last:rounded-b-md";

type PendingInstance = {
  attempt: ExportAttempt;
  instance: EditingInstance;
};

interface SourceListItemExtraItemProps {
  pending: PendingInstance[];
}

function SourceListItemExtra({ source }: { source: EditingInstance }) {
  const { active, pending: queuePending } = useAppSelector(selectExportQueue);
  const queueStarted = useAppSelector(selectQueueStarted);
  const pending = queuePending.filter(({ instance }) => instance.id === source.id);
  const queueBusy = queueStarted || active !== undefined || queuePending.length > 0;
  const showTerminalAction =
    source.sourceAvailability === "deleted" || (!queueBusy && source.exportAttempts.length > 0);

  if (pending.length === 0 && !showTerminalAction) return null;

  return (
    <div className="w-full px-3">
      <ul className="flex flex-col ring-1 ring-foreground/10">
        {pending.length > 0 ? <SourceListItemExports pending={pending} /> : null}
        <SourceListItemActions
          active={active}
          pending={pending}
          queueBusy={queueBusy}
          source={source}
        />
      </ul>
    </div>
  );
}

function SourceListItemExports({ pending }: SourceListItemExtraItemProps) {
  return (
    <li>
      <ul>
        {pending.map(({ attempt }) => (
          <SourceListItemExport attempt={attempt} key={attempt.id} />
        ))}
      </ul>
    </li>
  );
}

function SourceListItemExport({ attempt }: { attempt: ExportAttempt }) {
  const { t } = useTranslation();

  const statusLabel =
    attempt.state.status === "queued"
      ? t("source.status.queued")
      : attempt.state.status === "rendering"
        ? t("source.status.rendering")
        : attempt.state.status === "completed"
          ? t("source.status.completed")
          : attempt.state.status === "failed"
            ? t("source.status.failed")
            : t("source.status.canceled");

  return (
    <li className={sourceListItemExtraClassName}>
      <Button className="w-full justify-between" size="xs" variant="ghost">
        <div className="flex items-center gap-2">
          {attempt.route === "fast" ? (
            <Scissors aria-hidden="true" />
          ) : (
            <Settings2 aria-hidden="true" />
          )}
          <span
            className="truncate text-xs text-muted-foreground"
            title={attempt.output.displayName}
          >
            {attempt.output.displayName}
          </span>
        </div>
        <Badge variant="outline">
          <span className={attempt.state.status === "rendering" ? "shimmer" : undefined}>
            {statusLabel}
          </span>
        </Badge>
      </Button>
    </li>
  );
}

function SourceListItemActions({
  active,
  pending,
  queueBusy,
  source,
}: SourceListItemExtraItemProps & {
  active?: PendingInstance;
  queueBusy: boolean;
  source: EditingInstance;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const queueStarted = useAppSelector(selectQueueStarted);

  if (active) return null;

  if (source.sourceAvailability === "deleted") {
    return (
      <li className={sourceListItemExtraClassName}>
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
      </li>
    );
  }

  if (pending.length > 0) {
    if (queueStarted) return null;

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

  if (queueBusy || source.exportAttempts.length === 0) return null;

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

export { SourceList };
