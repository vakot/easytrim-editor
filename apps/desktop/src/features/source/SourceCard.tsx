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
import type { ComponentProps } from "react";

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

import { cn } from "@/lib/class-names.utils";

import { formatSourcePath } from "./lib/media-formatters.utils";

export type SourceCardStatus =
  | "canceled"
  | "completed"
  | "deleted"
  | "failed"
  | "loading"
  | "missing"
  | "queued"
  | "ready"
  | "rendering";

export type SourceCardVariant = "default" | "destructive" | "success" | "warning";

export interface SourceCardLabels {
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
  active: boolean;
  displayName: string;
  id: string;
  labels: SourceCardLabels;
  onClose: () => void;
  onDelete: () => void;
  onOpen: () => void;
  onRestore: () => void;
  onReveal: () => void;
  previewUrl?: string;
  showRestore: boolean;
  sourcePath: string;
  status: SourceCardStatus;
  statusLabel: string;
  variant: SourceCardVariant;
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

export function SourceCard({
  active,
  displayName,
  id,
  labels,
  onClose,
  onDelete,
  onOpen,
  onRestore,
  onReveal,
  previewUrl,
  showRestore,
  sourcePath,
  status,
  statusLabel,
  variant,
}: SourceCardProps) {
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
    </Card>
  );
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
