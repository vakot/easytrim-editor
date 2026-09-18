import type { TFunction } from "i18next";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileVideo,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { memo, type MouseEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceById,
} from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourceThumbnail } from "@/app/store/slices/preview-slice";
import { selectSourceStatus } from "@/app/store/slices/source-slice";
import {
  closeEditingInstancesRequested,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";
import { openFileLocation } from "@/lib/tauri/media";

import { formatSourcePath } from "../lib/media-formatters.utils";
import { getRevealLabel } from "../lib/source.utils";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./DeleteSourceDialog";
import { useSourceSelection } from "./SourceSelectionContext";

type SourceCardStatus = "deleted" | "failed" | "loading" | "missing" | "ready";

type SourceCardVariant = "default" | "destructive" | "warning";

export interface SourceCardProps {
  source: EditingInstance;
}

const statusIcons: Record<SourceCardStatus, typeof CheckCircle2> = {
  deleted: CircleAlert,
  failed: CircleAlert,
  loading: LoaderCircle,
  missing: CircleAlert,
  ready: CheckCircle2,
};

const statusBadgeClassNames: Record<SourceCardVariant, string> = {
  default: "bg-card/90 text-muted-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

export const SourceCard = memo(function SourceCard({ source }: SourceCardProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourceStatus = useAppSelector(selectSourceStatus);
  const { selectedSourceIds, selectSource } = useSourceSelection();

  const id = source.id;
  const [contextSourceIds, setContextSourceIds] = useState<string[]>([id]);
  const [contextMenuIsSelection, setContextMenuIsSelection] = useState(false);
  const active = id === activeInstanceId;
  const selected = selectedSourceIds.has(id);
  const { displayName, sourcePath } = source.snapshot.source;
  const status = getSourceCardStatus(source, active, sourceStatus);
  const statusLabel = getSourceCardStatusLabel(t, status);
  const variant = getSourceCardVariant(status);
  const thumbnail = useAppSelector((state) => selectImportedSourceThumbnail(state, id));
  const thumbnailUrl = thumbnail?.status === "ready" ? thumbnail.value.url : undefined;
  const thumbnailLoading =
    !thumbnailUrl &&
    source.sourceAvailability === "available" &&
    (thumbnail === undefined || thumbnail.status === "loading");

  const StatusIcon = statusIcons[status];
  const contextSources = useAppSelector(
    (state) =>
      contextSourceIds.flatMap((sourceId) => {
        const contextSource = selectEditingInstanceById(state, sourceId);
        if (contextSource) return [contextSource];
        return sourceId === id ? [source] : [];
      }),
    shallowEqual,
  );

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    const modifiers = {
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    };

    selectSource(id, modifiers);
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
      void dispatch(navigateToEditingInstance(id));
    }
  };

  const handleContextMenu = () => {
    const sourceIsSelected = selectedSourceIds.has(id);
    setContextMenuIsSelection(sourceIsSelected && selectedSourceIds.size > 1);
    setContextSourceIds(sourceIsSelected ? [...selectedSourceIds] : [id]);
  };

  return (
    <DeleteSourceDialog sourceIds={contextSourceIds}>
      <ContextMenu>
        <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
          <Card
            aria-checked={selected}
            aria-label={displayName}
            className={cn(
              "cursor-pointer pt-0",
              selected ? "ring-2 ring-primary/70" : undefined,
              active ? "ring-2 ring-primary" : undefined,
            )}
            data-active={active ? "true" : "false"}
            data-selected={selected ? "true" : "false"}
            data-source-id={id}
            onClick={handleCardClick}
            onKeyDown={(event) => {
              if (
                event.target !== event.currentTarget ||
                (event.key !== " " && event.key !== "Enter")
              ) {
                return;
              }

              event.preventDefault();
              selectSource(id, {
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                shiftKey: event.shiftKey,
              });
              if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                void dispatch(navigateToEditingInstance(id));
              }
            }}
            role="checkbox"
            tabIndex={0}
            variant={variant}
          >
            <div className="group relative aspect-video w-full overflow-hidden bg-muted text-muted-foreground">
              {thumbnailUrl ? (
                <img
                  alt={`${displayName} thumbnail`}
                  aria-label={`${displayName} thumbnail`}
                  className="group-hover:scale-1.02 size-full object-cover transition-transform"
                  src={thumbnailUrl}
                />
              ) : thumbnailLoading ? (
                <span
                  aria-label={t("source.status.loading")}
                  className="grid size-full place-items-center bg-linear-to-br from-muted to-background"
                  role="status"
                >
                  <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-primary" />
                </span>
              ) : (
                <span className="grid size-full place-items-center bg-linear-to-br from-muted to-background">
                  <span className="grid justify-items-center gap-2">
                    <FileVideo aria-hidden="true" className="size-8 opacity-40" />
                    <span className="text-[10px]">{t("source.messages.previewUnavailable")}</span>
                  </span>
                </span>
              )}
              {status !== "ready" ? (
                <Badge
                  className={`absolute top-2 left-2 gap-1 backdrop-blur-sm ${statusBadgeClassNames[variant]}`}
                  size="xs"
                  variant="outline"
                >
                  <StatusIcon
                    aria-hidden="true"
                    className={status === "loading" ? "animate-spin" : undefined}
                  />
                  {statusLabel}
                </Badge>
              ) : null}
            </div>

            <CardHeader>
              <CardTitle className="truncate text-sm" title={displayName}>
                {displayName}
              </CardTitle>
              <CardDescription className="truncate" title={sourcePath}>
                {formatSourcePath(sourcePath)}
              </CardDescription>
              <CardAction
                className="flex items-center gap-1"
                onClick={(event) => event.stopPropagation()}
              >
                <SourceCardActions source={source} />
              </CardAction>
            </CardHeader>
          </Card>
        </ContextMenuTrigger>

        {contextMenuIsSelection ? (
          <SourceCardContextMenu sourceIds={contextSourceIds} sources={contextSources} />
        ) : (
          <SourceCardIndividualContextMenu source={source} />
        )}
      </ContextMenu>
    </DeleteSourceDialog>
  );
});

function SourceCardIndividualContextMenu({ source }: { source: EditingInstance }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { sourcePath } = source.snapshot.source;
  const showRestore = source.sourceAvailability === "deleted";
  const revealLabel = getRevealLabel(t);

  return (
    <ContextMenuContent>
      <ContextMenuItem
        disabled={showRestore}
        inset
        onSelect={() => void openFileLocation(sourcePath)}
      >
        <ContextMenuIcon>
          <ExternalLink aria-hidden="true" />
        </ContextMenuIcon>
        {revealLabel}
      </ContextMenuItem>

      <ContextMenuItem
        inset
        onSelect={() => void dispatch(closeEditingInstancesRequested([source.id]))}
      >
        <ContextMenuIcon>
          <X aria-hidden="true" />
        </ContextMenuIcon>
        {t("app.actions.closeFile")}
      </ContextMenuItem>

      <ContextMenuSeparator />

      {showRestore ? (
        <ContextMenuItem
          inset
          onSelect={() =>
            void dispatch(restoreSourceFileRequested({ itemId: source.id, sourcePath }))
          }
          variant="success"
        >
          <ContextMenuIcon>
            <RotateCcw aria-hidden="true" />
          </ContextMenuIcon>
          {t("app.actions.restore")}
        </ContextMenuItem>
      ) : (
        <DeleteSourceDialogTrigger asChild>
          <ContextMenuItem inset onSelect={(event) => event.preventDefault()} variant="destructive">
            <ContextMenuIcon>
              <Trash2 aria-hidden="true" />
            </ContextMenuIcon>
            {t("app.actions.deleteFile")}
          </ContextMenuItem>
        </DeleteSourceDialogTrigger>
      )}
    </ContextMenuContent>
  );
}

function SourceCardContextMenu({
  sourceIds,
  sources,
}: {
  sourceIds: string[];
  sources: EditingInstance[];
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const revealLabel = getRevealLabel(t);
  const count = sources.length;
  const deletableSources = sources.filter((source) => source.sourceAvailability !== "deleted");
  const restorableSources = sources.filter((source) => source.sourceAvailability === "deleted");

  return (
    <ContextMenuContent>
      <ContextMenuSub>
        <ContextMenuSubTrigger inset>
          <ContextMenuIcon>
            <ExternalLink aria-hidden="true" />
          </ContextMenuIcon>
          {revealLabel}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {sources.map(({ id, snapshot, sourceAvailability }) => (
            <ContextMenuItem
              disabled={sourceAvailability === "deleted"}
              key={id}
              onSelect={() => void openFileLocation(snapshot.source.sourcePath)}
            >
              {snapshot.source.displayName}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuItem
        inset
        onSelect={() => void dispatch(closeEditingInstancesRequested(sourceIds))}
      >
        <ContextMenuIcon>
          <X aria-hidden="true" />
        </ContextMenuIcon>
        {t("app.actions.closeFiles", { count })}
      </ContextMenuItem>

      <ContextMenuSeparator />

      <DeleteSourceDialogTrigger asChild>
        <ContextMenuItem
          disabled={deletableSources.length === 0}
          inset
          onSelect={(event) => event.preventDefault()}
          variant="destructive"
        >
          <ContextMenuIcon>
            <Trash2 aria-hidden="true" />
          </ContextMenuIcon>
          {t("app.actions.deleteFiles", { count })}
        </ContextMenuItem>
      </DeleteSourceDialogTrigger>

      {restorableSources.length > 0 ? (
        <ContextMenuItem
          inset
          onSelect={() =>
            void Promise.all(
              restorableSources.map(({ id, snapshot }) =>
                dispatch(
                  restoreSourceFileRequested({
                    itemId: id,
                    sourcePath: snapshot.source.sourcePath,
                  }),
                ),
              ),
            )
          }
          variant="success"
        >
          <ContextMenuIcon>
            <RotateCcw aria-hidden="true" />
          </ContextMenuIcon>
          {t("app.actions.restore")}
        </ContextMenuItem>
      ) : null}
    </ContextMenuContent>
  );
}

function getSourceCardStatus(
  instance: EditingInstance,
  active: boolean,
  sourceStatus: ReturnType<typeof selectSourceStatus>,
): SourceCardStatus {
  if (instance.sourceAvailability === "deleted") return "deleted";
  if (instance.sourceAvailability === "missing") return "missing";

  if (active && sourceStatus === "failed") return "failed";
  if (active && sourceStatus === "loading-source") return "loading";
  return "ready";
}

function getSourceCardVariant(status: SourceCardStatus): SourceCardVariant {
  switch (status) {
    case "deleted":
    case "failed":
      return "destructive";
    case "ready":
      return "default";
    case "loading":
    case "missing":
      return "warning";
  }
}

function getSourceCardStatusLabel(t: TFunction, status: SourceCardStatus): string {
  switch (status) {
    case "deleted":
      return t("source.status.deleted");
    case "failed":
      return t("source.status.failed");
    case "loading":
      return t("source.status.loading");
    case "missing":
      return t("source.status.missing");
    case "ready":
      return t("source.status.ready");
  }
}

function SourceCardActions({ source }: { source: EditingInstance }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const id = source.id;
  const { displayName, sourcePath } = source.snapshot.source;
  const showRestore = source.sourceAvailability === "deleted";
  const revealLabel = getRevealLabel(t);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`${t("source.actions.sourceActions")}: ${displayName}`}
              size="icon-xs"
              variant="ghost"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("source.actions.sourceActions")}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={showRestore}
          inset
          onSelect={() => void openFileLocation(sourcePath)}
        >
          <DropdownMenuIcon>
            <ExternalLink aria-hidden="true" />
          </DropdownMenuIcon>

          {revealLabel}
        </DropdownMenuItem>

        <DropdownMenuItem
          inset
          onSelect={() => void dispatch(closeEditingInstancesRequested([id]))}
        >
          <DropdownMenuIcon>
            <X aria-hidden="true" />
          </DropdownMenuIcon>

          {t("app.actions.closeFile")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {showRestore ? (
          <DropdownMenuItem
            inset
            onSelect={() => void dispatch(restoreSourceFileRequested({ itemId: id, sourcePath }))}
            variant="success"
          >
            <DropdownMenuIcon>
              <RotateCcw aria-hidden="true" />
            </DropdownMenuIcon>

            {t("app.actions.restore")}
          </DropdownMenuItem>
        ) : (
          <DeleteSourceDialog sourceId={id}>
            <DeleteSourceDialogTrigger asChild>
              <DropdownMenuItem
                inset
                onSelect={(event) => event.preventDefault()}
                variant="destructive"
              >
                <DropdownMenuIcon>
                  <Trash2 aria-hidden="true" />
                </DropdownMenuIcon>

                {t("app.actions.deleteFile")}
              </DropdownMenuItem>
            </DeleteSourceDialogTrigger>
          </DeleteSourceDialog>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
