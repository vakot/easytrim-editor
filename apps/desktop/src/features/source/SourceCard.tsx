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
import { type ComponentProps, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourcePreviews } from "@/app/store/slices/preview-slice";
import { selectSourceStatus } from "@/app/store/slices/source-slice";
import {
  closeEditingInstancesRequested,
  navigateToEditingInstance,
  restoreSourceFileRequested,
} from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";
import { openFileLocation } from "@/lib/tauri/media";

import { DeleteSourceDialog } from "./components/DeleteSourceDialog";
import { formatSourcePath } from "./lib/media-formatters.utils";

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

interface SourceCardLabels {
  actions: string;
  active: string;
  close: string;
  deleteSource: string;
  imported: string;
  open: string;
  previewUnavailable: string;
  restore: string;
  restoreSource: string;
  reveal: string;
}

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const active = source.id === activeInstanceId;
  const displayName = source.snapshot.source.displayName;
  const id = source.id;
  const sourcePath = source.snapshot.source.sourcePath;
  const status = getSourceCardStatus(source, active, sourceStatus);
  const statusLabel = getSourceCardStatusLabel(t, status);
  const variant = getSourceCardVariant(status);
  const showRestore = source.sourceAvailability === "deleted";
  const preview = importedPreviews[source.id];
  const previewUrl = preview?.status === "ready" ? preview.value.url : undefined;
  const labels: SourceCardLabels = {
    actions: t("source.actions.sourceActions"),
    active: t("source.labels.active"),
    close: t("source.actions.close"),
    deleteSource: t("source.actions.deleteSource"),
    imported: t("source.labels.imported"),
    open: t("app.actions.open"),
    previewUnavailable: t("source.messages.previewUnavailable"),
    reveal: t("source.actions.reveal"),
    restore: t("app.actions.restore"),
    restoreSource: t("source.actions.restoreSource"),
  };

  const onClose = () => void dispatch(closeEditingInstancesRequested([id]));
  const onDelete = () => setDeleteDialogOpen(true);
  const onOpen = () => void dispatch(navigateToEditingInstance(id));
  const onRestore = () => void dispatch(restoreSourceFileRequested({ itemId: id, sourcePath }));
  const onReveal = () => void openFileLocation(sourcePath);
  const StatusIcon = statusIcons[status];
  const actionLabel = showRestore ? labels.restore : labels.open;
  const actionVariant: ComponentProps<typeof Button>["variant"] = showRestore
    ? "success"
    : "default";

  return (
    <Card
      className={cn("pt-0", active ? "ring-primary" : undefined)}
      data-active={active ? "true" : "false"}
      data-source-id={id}
      variant={variant}
    >
      <button
        aria-label={`${labels.open}: ${displayName}`}
        className="group relative aspect-video w-full cursor-pointer overflow-hidden bg-muted text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={onOpen}
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
        ) : (
          <span className="grid size-full place-items-center bg-linear-to-br from-muted to-background">
            <span className="grid justify-items-center gap-2">
              <FileVideo aria-hidden="true" className="size-8 opacity-40" />
              <span className="text-[10px]">{labels.previewUnavailable}</span>
            </span>
          </span>
        )}
        <Badge
          className={`absolute top-2 left-2 gap-1 backdrop-blur-sm ${statusBadgeClassNames[variant]}`}
          size="xs"
          variant="outline"
        >
          <StatusIcon
            aria-hidden="true"
            className={status === "loading" || status === "rendering" ? "animate-spin" : undefined}
          />
          {statusLabel}
        </Badge>
      </button>

      <CardHeader>
        <CardTitle className="truncate text-sm" title={displayName}>
          {displayName}
        </CardTitle>
        <CardDescription className="truncate" title={sourcePath}>
          {formatSourcePath(sourcePath)}
        </CardDescription>
        <CardAction>
          <SourceCardActions
            displayName={displayName}
            labels={labels}
            onClose={onClose}
            onDelete={onDelete}
            onOpen={onOpen}
            onRestore={onRestore}
            onReveal={onReveal}
            showRestore={showRestore}
          />
        </CardAction>
      </CardHeader>

      <CardFooter className="justify-between gap-2 px-3 py-2.5">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {active ? labels.active : labels.imported}
        </span>
        <Button onClick={showRestore ? onRestore : onOpen} size="xs" variant={actionVariant}>
          {actionLabel}
        </Button>
      </CardFooter>

      <DeleteSourceDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen} sourceId={id}>
        <span aria-hidden="true" />
      </DeleteSourceDialog>
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

function SourceCardActions({
  displayName,
  labels,
  onClose,
  onDelete,
  onOpen,
  onRestore,
  onReveal,
  showRestore,
}: {
  displayName: string;
  labels: SourceCardLabels;
  onClose: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onRestore: () => void;
  onReveal: () => void;
  showRestore: boolean;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`${labels.actions}: ${displayName}`} size="icon-xs" variant="ghost">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{labels.actions}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onOpen}>
          <ExternalLink aria-hidden="true" />
          {labels.open}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={showRestore} onSelect={onReveal}>
          <ExternalLink aria-hidden="true" />
          {labels.reveal}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {showRestore ? (
          <DropdownMenuItem onSelect={onRestore} variant="success">
            <RotateCcw aria-hidden="true" />
            {labels.restoreSource}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onDelete} variant="destructive">
            <Trash2 aria-hidden="true" />
            {labels.deleteSource}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onClose}>
          <X aria-hidden="true" />
          {labels.close}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
