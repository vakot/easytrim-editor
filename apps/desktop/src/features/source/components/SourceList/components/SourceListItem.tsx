import type { TFunction } from "i18next";
import {
  ExternalLink,
  MoreHorizontal,
  Play,
  RotateCcw,
  Scissors,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { memo, type MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Highlight } from "@/components/ui/highlight";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceById,
  selectExportQueueById,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceExportQueueState } from "@/app/store/slices/export-slice";
import { cancelExportAttemptRequested } from "@/app/store/thunks/export-thunks";
import {
  closeEditingInstancesRequested,
  navigateToEditingInstance,
  prepareImportedSourceThumbnailsRequested,
  releaseImportedSourceThumbnailDemand,
  restoreExportAttemptRequested,
} from "@/app/store/thunks/source-media-thunks";
import type {
  EditingInstance,
  EditingInstanceListEntry,
  ExportAttempt,
  ExportAttemptState,
} from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";
import { openFileLocation } from "@/lib/tauri/media";

import { formatBytes, formatSourcePath } from "../../../lib/media-formatters.utils";
import { getRevealLabel } from "../../../lib/source.utils";
import type { SourceSearchResult } from "../../../lib/source-search.utils";
import {
  SourceCard,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardStatusBadge,
  SourceCardThumbnail,
  SourceCardTitle,
} from "../../SourceCard";
import {
  CancelSourceExport,
  DeleteSource,
  RestoreSource,
  StartSourceExport,
} from "../../SourceMenuActions";

import styles from "./SourceListItem.module.css";

const SourceListItem = memo(function SourceListItem({
  isAdded,
  isExiting,
  isScrolling,
  match,
  onAdditionAnimationStart,
  source: sourceEntry,
}: {
  isAdded: boolean;
  isExiting: boolean;
  isScrolling: boolean;
  match: SourceSearchResult | undefined;
  onAdditionAnimationStart: (sourceId: string) => boolean;
  source: EditingInstanceListEntry;
}) {
  const dispatch = useAppDispatch();
  const sourceId = sourceEntry.id;
  const selectSource = useCallback(
    (state: Parameters<typeof selectEditingInstanceById>[0]) =>
      selectEditingInstanceById(state, sourceId),
    [sourceId],
  );

  const selectedSource = useAppSelector(selectSource);
  const [lastKnownSource, setLastKnownSource] = useState(selectedSource);
  const [isEntering, setIsEntering] = useState(false);
  if (selectedSource && selectedSource !== lastKnownSource) setLastKnownSource(selectedSource);
  const source = selectedSource ?? lastKnownSource;
  const sourceRef = useRef(source);
  const itemRef = useRef<HTMLDivElement>(null);
  const sourcePath = sourceEntry.sourcePath;
  const sourceAvailability = source?.sourceAvailability;
  const active = useAppSelector((state) => selectActiveInstanceId(state) === sourceId);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    // This one-time state transition marks only a real collection addition;
    // virtual range mount/unmounts never set isAdded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAdded && onAdditionAnimationStart(sourceId)) setIsEntering(true);
  }, [isAdded, onAdditionAnimationStart, sourceId]);

  useEffect(() => {
    const element = itemRef.current;
    if (isExiting || isScrolling) return;
    if (!element || !sourcePath || sourceAvailability !== "available") return;
    const latestSource = sourceRef.current;
    if (latestSource) dispatch(prepareImportedSourceThumbnailsRequested([latestSource]));
    return () => dispatch(releaseImportedSourceThumbnailDemand(sourceId));
  }, [dispatch, isExiting, isScrolling, sourceAvailability, sourceId, sourcePath]);

  const handleClose = useCallback(
    () => void dispatch(closeEditingInstancesRequested([sourceId])),
    [dispatch, sourceId],
  );

  if (isExiting) {
    return <SourceListItemTombstone source={sourceEntry} />;
  }

  if (!source || isScrolling) {
    return <SourceListItemShell active={active} match={match} source={sourceEntry} />;
  }

  return (
    <div
      className={cn(styles.sourceListItem, "h-18 w-full min-w-0", isEntering && styles.isEntering)}
      data-entering={isEntering ? "true" : undefined}
      onAnimationEnd={() => setIsEntering(false)}
      ref={itemRef}
    >
      <SourceListItemCard match={match} onClose={handleClose} source={source} />
    </div>
  );
}, areSourceListItemPropsEqual);

function areSourceListItemPropsEqual(
  previous: {
    isAdded: boolean;
    isExiting: boolean;
    isScrolling: boolean;
    match: SourceSearchResult | undefined;
    onAdditionAnimationStart: (sourceId: string) => boolean;
    source: EditingInstanceListEntry;
  },
  next: {
    isAdded: boolean;
    isExiting: boolean;
    isScrolling: boolean;
    match: SourceSearchResult | undefined;
    onAdditionAnimationStart: (sourceId: string) => boolean;
    source: EditingInstanceListEntry;
  },
): boolean {
  return (
    previous.source.id === next.source.id &&
    areListEntriesEqual(previous.source, next.source) &&
    previous.isAdded === next.isAdded &&
    previous.isExiting === next.isExiting &&
    previous.isScrolling === next.isScrolling &&
    previous.onAdditionAnimationStart === next.onAdditionAnimationStart &&
    areSearchRangesEqual(previous.match, next.match)
  );
}

function areListEntriesEqual(left: EditingInstanceListEntry, right: EditingInstanceListEntry) {
  return (
    left.displayName === right.displayName &&
    left.fileSizeBytes === right.fileSizeBytes &&
    left.sourceAvailability === right.sourceAvailability &&
    left.sourcePath === right.sourcePath &&
    left.updatedAtMicros === right.updatedAtMicros
  );
}

function SourceListItemTombstone({ source }: { source: EditingInstanceListEntry }) {
  return (
    <div
      className={cn(styles.sourceListItem, "h-18 w-full min-w-0", styles.isClosing)}
      data-exiting="true"
      data-testid={source.id}
    >
      <div className="flex h-full min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-foreground/10 bg-card p-2 text-card-foreground ring-1 ring-foreground/10">
        <div className="h-[54px] w-24 shrink-0 rounded-md bg-muted" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={source.displayName}>
            {source.displayName}
          </div>
          <div className="truncate text-xs text-muted-foreground" title={source.sourcePath}>
            {formatSourcePath(source.sourcePath)}
          </div>
        </div>
      </div>
    </div>
  );
}

const SourceListItemShell = memo(function SourceListItemShell({
  active,
  match,
  source,
}: {
  active: boolean;
  match: SourceSearchResult | undefined;
  source: EditingInstanceListEntry;
}) {
  const { i18n, t } = useTranslation();
  const dispatch = useAppDispatch();
  const updatedAt = source.updatedAtMicros
    ? new Date(source.updatedAtMicros / 1_000).toLocaleDateString(i18n.resolvedLanguage)
    : t("common.status.unknown");

  return (
    <Card
      aria-checked={active}
      aria-label={source.displayName}
      className={cn(
        "h-full min-h-0 min-w-0 flex-row items-center gap-2 overflow-hidden p-2",
        active && "border-primary/45 bg-primary/5 ring-2 ring-primary/45",
      )}
      data-active={active ? "true" : "false"}
      data-source-id={source.id}
      data-testid={source.id}
      onClick={() => void dispatch(navigateToEditingInstance(source.id))}
      role="checkbox"
      tabIndex={0}
    >
      <div className="h-[54px] w-24 shrink-0 rounded-md bg-muted" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div
            className="truncate text-sm font-medium whitespace-nowrap"
            title={source.displayName}
          >
            <Highlight ranges={match?.displayNameRanges}>{source.displayName}</Highlight>
          </div>
          <div
            className="truncate text-xs whitespace-nowrap text-muted-foreground"
            title={source.sourcePath}
          >
            <Highlight ranges={match?.sourcePathRanges}>
              {formatSourcePath(source.sourcePath)}
            </Highlight>
          </div>
        </div>
        <div className="hidden max-w-32 shrink-0 truncate text-xs whitespace-nowrap text-muted-foreground sm:flex">
          {formatBytes(source.fileSizeBytes, t("common.status.unknown"))} · {updatedAt}
        </div>
      </div>
    </Card>
  );
});

function areSearchRangesEqual(
  left: SourceSearchResult | undefined,
  right: SourceSearchResult | undefined,
): boolean {
  return (
    areRangesEqual(left?.displayNameRanges ?? [], right?.displayNameRanges ?? []) &&
    areRangesEqual(left?.sourcePathRanges ?? [], right?.sourcePathRanges ?? [])
  );
}

function areRangesEqual(
  left: ReadonlyArray<readonly [number, number]>,
  right: ReadonlyArray<readonly [number, number]>,
): boolean {
  return (
    left.length === right.length &&
    left.every(([start, end], index) => {
      const range = right[index];
      return range?.[0] === start && range[1] === end;
    })
  );
}

const SourceListItemCard = memo(function SourceListItemCard({
  match,
  onClose,
  source,
}: {
  match: SourceSearchResult | undefined;
  onClose: () => void;
  source: EditingInstance;
}) {
  const { t } = useTranslation();

  return (
    <SourceCard
      className="h-full min-h-0 min-w-0 flex-row items-center gap-2 overflow-hidden p-2"
      source={source}
    >
      <SourceCardThumbnail className="h-[54px] w-24 shrink-0 rounded-md shadow">
        <SourceCardStatusBadge className="absolute top-2 left-2" />
      </SourceCardThumbnail>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5" data-slot="card-header">
          <SourceCardTitle className="truncate text-sm whitespace-nowrap">
            {({ source: cardSource }) => (
              <Highlight ranges={match?.displayNameRanges}>
                {cardSource.snapshot.source.displayName}
              </Highlight>
            )}
          </SourceCardTitle>
          <SourceCardDescription className="truncate text-xs whitespace-nowrap">
            {({ source: cardSource }) => (
              <Highlight ranges={match?.sourcePathRanges}>
                {formatSourcePath(cardSource.snapshot.source.sourcePath)}
              </Highlight>
            )}
          </SourceCardDescription>
        </div>

        <SourceCardMetadata className="hidden max-w-32 shrink-0 truncate whitespace-nowrap sm:flex" />
        <SourceListItemRowAction onClose={onClose} source={source} />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              aria-label={`${t("source.actions.sourceActions")}: ${source.snapshot.source.displayName}`}
              className="shrink-0 transition-none"
              onClick={(event) => event.stopPropagation()}
              size="icon-sm"
              variant="secondary"
            >
              {source.exportAttempts.length > 0 ? (
                <span aria-hidden="true" className="text-xs tabular-nums">
                  {source.exportAttempts.length}
                </span>
              ) : (
                <MoreHorizontal aria-hidden="true" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="max-h-[min(70vh,32rem)] overflow-y-auto p-2">
            <ul className="flex min-w-0 flex-col overflow-hidden rounded-md border">
              <SourceListItemExports sourceId={source.id} />
              <li className={cn(sourceListItemExtraClassName, "flex gap-1")}>
                <SourceListItemActions source={source} />
              </li>
              <li className={cn(sourceListItemExtraClassName, "flex gap-1")}>
                <Button
                  className="flex-1"
                  onClick={() => void openFileLocation(source.snapshot.source.sourcePath)}
                  size="xs"
                  variant="ghost"
                >
                  <ExternalLink aria-hidden="true" />
                  {getRevealLabel(t)}
                </Button>
                <DeleteSource source={source}>
                  <Button size="xs" variant="destructive">
                    <Trash2 aria-hidden="true" />
                    {t("app.actions.deleteFile")}
                  </Button>
                </DeleteSource>
              </li>
              <li className={cn(sourceListItemExtraClassName, "flex gap-1")}>
                <Button className="flex-1" onClick={onClose} size="xs" variant="ghost">
                  <X aria-hidden="true" />
                  {t("app.actions.closeFile")}
                </Button>
              </li>
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </SourceCard>
  );
});

function SourceListItemRowAction({
  onClose,
  source,
}: {
  onClose: () => void;
  source: EditingInstance;
}) {
  const { t } = useTranslation();
  const { hasQueuedExports, isRunning } = useAppSelector((state) =>
    selectSourceExportQueueState(state, source.id),
  );

  const stopCardActivation = (event: MouseEvent<HTMLButtonElement>) => event.stopPropagation();

  if (source.sourceAvailability === "deleted") {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <RestoreSource event="click" source={source}>
          <Button
            aria-label={t("app.actions.restore")}
            onClick={stopCardActivation}
            size="icon-sm"
            title={t("app.actions.restore")}
            variant="success"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </RestoreSource>
        <Button
          aria-label={t("app.actions.closeFile")}
          onClick={(event) => {
            stopCardActivation(event);
            onClose();
          }}
          size="icon-sm"
          title={t("app.actions.closeFile")}
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    );
  }

  if (isRunning) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Badge className="whitespace-nowrap" variant="outline">
          {t("source.status.rendering")}
        </Badge>
        <CancelSourceExport event="click" source={source}>
          <Button
            aria-label={t("queue.actions.cancel")}
            onClick={stopCardActivation}
            size="icon-sm"
            title={t("queue.actions.cancel")}
            variant="destructive"
          >
            <X aria-hidden="true" />
          </Button>
        </CancelSourceExport>
      </div>
    );
  }

  if (hasQueuedExports) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Badge className="whitespace-nowrap" variant="outline">
          {t("source.status.queued")}
        </Badge>
        <StartSourceExport event="click" source={source}>
          <Button
            aria-label={t("queue.actions.start")}
            onClick={stopCardActivation}
            size="icon-sm"
            title={t("queue.actions.start")}
            variant="secondary"
          >
            <Play aria-hidden="true" />
          </Button>
        </StartSourceExport>
      </div>
    );
  }

  return null;
}

const sourceListItemExtraClassName = "min-w-0 min-h-8 border-t bg-muted/50 p-1 first:border-t-0";

function SourceListItemExports({ sourceId }: { sourceId: string }) {
  const items = useAppSelector((state) => selectExportQueueById(state, sourceId));

  if (items.length === 0) return null;

  return items.map(({ attempt }) => (
    <li className={sourceListItemExtraClassName} key={attempt.id}>
      <SourceListItemExport attempt={attempt} instanceId={sourceId} />
    </li>
  ));
}

function SourceListItemExport({
  attempt,
  instanceId,
}: {
  attempt: ExportAttempt;
  instanceId: string;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceAvailable = useAppSelector(
    (state) => selectEditingInstanceById(state, instanceId)?.sourceAvailability === "available",
  );

  const statusLabel = getExportQueueItemStatusLabel(t, attempt.state.status);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <Button
        className="min-w-0 flex-1 shrink justify-between gap-2 disabled:opacity-100"
        disabled={!sourceAvailable || attempt.state.status === "rendering"}
        onClick={() =>
          void dispatch(restoreExportAttemptRequested({ instanceId, attemptId: attempt.id }))
        }
        size="xs"
        variant="ghost"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {attempt.route === "fast" ? (
            <Scissors aria-hidden="true" className="shrink-0" />
          ) : (
            <Settings2 aria-hidden="true" className="shrink-0" />
          )}
          <span
            className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            title={attempt.output.displayName}
          >
            {attempt.output.displayName}
          </span>
        </div>

        <Badge className="shrink-0 whitespace-nowrap text-muted-foreground" variant="outline">
          <span className={attempt.state.status === "rendering" ? "shimmer" : undefined}>
            {statusLabel}
          </span>
        </Badge>
      </Button>

      <SourceListItemExportAction attempt={attempt} instanceId={instanceId} />
    </div>
  );
}

function SourceListItemExportAction({
  attempt,
  instanceId,
}: {
  attempt: ExportAttempt;
  instanceId: string;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const state = attempt.state;

  if (state.status === "completed") {
    return (
      <Button
        aria-label={getRevealLabel(t)}
        onClick={() => void openFileLocation(state.result.displayPath)}
        size="icon-xs"
        title={getRevealLabel(t)}
        variant="secondary"
      >
        <ExternalLink aria-hidden="true" />
      </Button>
    );
  }

  if (state.status === "queued" || state.status === "rendering") {
    return (
      <Button
        aria-label={t("queue.actions.cancel")}
        onClick={() =>
          void dispatch(cancelExportAttemptRequested({ attemptId: attempt.id, instanceId }))
        }
        size="icon-xs"
        title={t("queue.actions.cancel")}
        variant="destructive"
      >
        <X aria-hidden="true" />
      </Button>
    );
  }

  return null;
}

function SourceListItemActions({ source }: { source: EditingInstance }) {
  const { t } = useTranslation();
  const { hasExports, hasQueuedExports, isRunning } = useAppSelector((state) =>
    selectSourceExportQueueState(state, source.id),
  );

  if (source.sourceAvailability === "deleted") {
    return (
      <>
        <RestoreSource event="click" source={source}>
          <Button size="xs" variant="success">
            <RotateCcw aria-hidden="true" />
            {t("app.actions.restore")}
          </Button>
        </RestoreSource>
      </>
    );
  }

  if (isRunning) {
    return (
      <CancelSourceExport event="click" source={source}>
        <Button size="xs" variant="destructive">
          <X aria-hidden="true" />
          {t("queue.actions.cancel")}
        </Button>
      </CancelSourceExport>
    );
  }

  if (hasQueuedExports) {
    return (
      <StartSourceExport event="click" source={source}>
        <Button size="xs">
          <Play aria-hidden="true" />
          {t("queue.actions.start")}
        </Button>
      </StartSourceExport>
    );
  }

  if (hasExports) {
    return (
      <>
        <DeleteSource event="click" source={source}>
          <Button size="xs" variant="destructive">
            <Trash2 aria-hidden="true" />
            {t("app.actions.deleteFile")}
          </Button>
        </DeleteSource>
      </>
    );
  }

  return null;
}

function getExportQueueItemStatusLabel(t: TFunction, status: ExportAttemptState["status"]): string {
  switch (status) {
    case "completed":
      return t("source.status.completed");
    case "failed":
      return t("source.status.failed");
    case "canceled":
      return t("source.status.canceled");
    case "rendering":
      return t("source.status.rendering");
    case "queued":
      return t("source.status.queued");
  }
}

export { SourceListItem };
