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
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectEditingInstanceById,
  selectExportQueueById,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceExportQueueState } from "@/app/store/slices/export-slice";
import { cancelExportAttemptRequested } from "@/app/store/thunks/export-thunks";
import { restoreExportAttemptRequested } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance, ExportAttempt, ExportAttemptState } from "@/domain/editing-instance";
import { openFileLocation } from "@/lib/tauri/media";

import { formatSourcePath } from "../../../lib/media-formatters.utils";
import { getRevealLabel } from "../../../lib/source.utils";
import {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardStatusBadge,
  SourceCardThumbnail,
  SourceCardTitle,
} from "../../SourceCard";
import {
  CancelSourceExport,
  CloseSource,
  DeleteSource,
  RestoreSource,
  StartSourceExport,
} from "../../SourceMenuActions";

function SourceListItem({ search, source }: { search: string; source: EditingInstance }) {
  return (
    <li className="flex w-full flex-col">
      <SourceListItemCard search={search} source={source} />
      <SourceListItemExtra source={source} />
    </li>
  );
}

function SourceListItemCard({ search, source }: { search: string; source: EditingInstance }) {
  const { t } = useTranslation();

  return (
    <SourceCard className="flex flex-row gap-2 p-2" source={source}>
      <SourceCardThumbnail className="w-6/11 shrink-0 rounded-md shadow">
        <SourceCardStatusBadge className="absolute top-2 left-2" />
      </SourceCardThumbnail>

      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1" data-slot="card-header">
          <SourceCardTitle className="line-clamp-2 wrap-break-word whitespace-normal">
            {({ source: cardSource }) => (
              <Highlight query={search}>{cardSource.snapshot.source.displayName}</Highlight>
            )}
          </SourceCardTitle>
          <SourceCardDescription className="line-clamp-2 wrap-anywhere whitespace-normal">
            {({ source: cardSource }) => (
              <Highlight query={search}>
                {formatSourcePath(cardSource.snapshot.source.sourcePath)}
              </Highlight>
            )}
          </SourceCardDescription>
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
        <li className={`${sourceListItemExtraClassName} flex gap-1`}>
          <SourceListItemActions source={source} />
        </li>
      </ul>
    </div>
  );
}

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
        className="min-w-0 flex-1 justify-between gap-2 disabled:opacity-100"
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
            className="min-w-0 truncate text-xs text-muted-foreground"
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
        <CloseSource event="click" source={source}>
          <Button size="xs" variant="ghost">
            <X aria-hidden="true" />
            {t("app.actions.closeFile")}
          </Button>
        </CloseSource>
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
        <CloseSource event="click" source={source}>
          <Button size="xs" variant="ghost">
            <X aria-hidden="true" />
            {t("app.actions.closeFile")}
          </Button>
        </CloseSource>
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
