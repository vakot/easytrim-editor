import type { TFunction } from "i18next";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileVideo,
  LoaderCircle,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourcePreviews, selectPreview } from "@/app/store/slices/preview-slice";
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
import { getRevealLabel } from "../lib/source-tree.utils";

import { DeleteSourceDialog, DeleteSourceDialogTrigger } from "./DeleteSourceDialog";

type SourceCardStatus =
  | "canceled"
  | "completed"
  | "deleted"
  | "failed"
  | "loading"
  | "missing"
  | "queued"
  | "ready"
  | "rendering";

type SourceCardVariant = "default" | "destructive" | "success" | "warning";

export interface SourceCardProps {
  source: EditingInstance;
}

const statusIcons: Record<SourceCardStatus, typeof CheckCircle2> = {
  canceled: CircleAlert,
  completed: CheckCircle2,
  deleted: CircleAlert,
  failed: CircleAlert,
  loading: LoaderCircle,
  missing: CircleAlert,
  queued: Clock3,
  ready: CheckCircle2,
  rendering: LoaderCircle,
};

const statusBadgeClassNames: Record<SourceCardVariant, string> = {
  default: "bg-card/90 text-muted-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

export function SourceCard({ source }: SourceCardProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourceStatus = useAppSelector(selectSourceStatus);
  const importedPreviews = useAppSelector(selectImportedSourcePreviews);
  const activePreview = useAppSelector(selectPreview);

  const id = source.id;
  const active = id === activeInstanceId;
  const { displayName, sourcePath } = source.snapshot.source;
  const status = getSourceCardStatus(source, active, sourceStatus);
  const statusLabel = getSourceCardStatusLabel(t, status);
  const variant = getSourceCardVariant(status);
  const preview = importedPreviews[source.id];
  const importedPreviewUrl = preview?.status === "ready" ? preview.value.url : undefined;
  const activePreviewUrl =
    active && activePreview.status === "ready" ? activePreview.value.url : undefined;

  const previewUrl = activePreviewUrl ?? importedPreviewUrl;
  const previewLoading =
    !previewUrl &&
    source.sourceAvailability === "available" &&
    (preview === undefined || preview.status === "loading" || activePreview.status === "loading");

  const StatusIcon = statusIcons[status];

  return (
    <Card
      className={cn("pt-0", active ? "ring-primary" : undefined)}
      data-active={active ? "true" : "false"}
      data-source-id={id}
      variant={variant}
    >
      <button
        aria-label={`${t("app.actions.open")}: ${displayName}`}
        className="group relative aspect-video w-full cursor-pointer overflow-hidden bg-muted text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={() => void dispatch(navigateToEditingInstance(id))}
        type="button"
      >
        {previewUrl ? (
          <video
            aria-label={`${displayName} preview`}
            className="group-hover:scale-1.02 size-full object-cover transition-transform"
            muted
            playsInline
            preload="metadata"
            src={previewUrl}
          />
        ) : previewLoading ? (
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
              className={
                status === "loading" || status === "rendering" ? "animate-spin" : undefined
              }
            />
            {statusLabel}
          </Badge>
        ) : null}
      </button>

      <CardHeader>
        <CardTitle className="truncate text-sm" title={displayName}>
          {displayName}
        </CardTitle>
        <CardDescription className="truncate" title={sourcePath}>
          {formatSourcePath(sourcePath)}
        </CardDescription>
        <CardAction>
          <SourceCardActions source={source} />
        </CardAction>
      </CardHeader>
    </Card>
  );
}

function getSourceCardStatus(
  instance: EditingInstance,
  active: boolean,
  sourceStatus: ReturnType<typeof selectSourceStatus>,
): SourceCardStatus {
  if (instance.sourceAvailability === "deleted") return "deleted";
  if (instance.sourceAvailability === "missing") return "missing";

  const latestAttempt = instance.exportAttempts.at(-1)?.state.status;
  if (latestAttempt === "queued" || latestAttempt === "rendering") return latestAttempt;
  if (latestAttempt === "completed") return "completed";
  if (latestAttempt === "failed") return "failed";
  if (latestAttempt === "canceled") return "canceled";
  if (active && sourceStatus === "failed") return "failed";
  if (active && sourceStatus === "loading-source") return "loading";
  return "ready";
}

function getSourceCardVariant(status: SourceCardStatus): SourceCardVariant {
  switch (status) {
    case "canceled":
    case "deleted":
    case "failed":
      return "destructive";
    case "completed":
      return "success";
    case "ready":
      return "default";
    case "loading":
    case "missing":
    case "queued":
    case "rendering":
      return "warning";
  }
}

function getSourceCardStatusLabel(t: TFunction, status: SourceCardStatus): string {
  switch (status) {
    case "canceled":
      return t("source.status.canceled");
    case "completed":
      return t("source.status.completed");
    case "deleted":
      return t("source.status.deleted");
    case "failed":
      return t("source.status.failed");
    case "loading":
      return t("source.status.loading");
    case "missing":
      return t("source.status.missing");
    case "queued":
      return t("source.status.queued");
    case "ready":
      return t("source.status.ready");
    case "rendering":
      return t("source.status.rendering");
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
