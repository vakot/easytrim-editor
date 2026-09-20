import type { TFunction } from "i18next";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileVideo,
  LoaderCircle,
  Play,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { type ComponentProps, createContext, memo, useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardTitle } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuIcon,
  ContextMenuItem,
  ContextMenuSeparator,
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
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectImportedSourceThumbnail } from "@/app/store/slices/preview-slice";
import { selectSourceStatus } from "@/app/store/slices/source-slice";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import type { EditingInstance } from "@/domain/editing-instance";
import { cn } from "@/lib/class-names.utils";
import { openFileLocation } from "@/lib/tauri/media";

import { useRelativeTimeNow } from "../hooks/use-relative-time";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  formatSourcePath,
} from "../lib/media-formatters.utils";
import { getRevealLabel } from "../lib/source.utils";

import { CloseSource, DeleteSource, RestoreSource } from "./SourceMenuActions";

type SourceCardStatus = "deleted" | "failed" | "loading" | "missing" | "ready";

type SourceCardVariant = ComponentProps<typeof Card>["variant"];
type SourceCardBadgeVariant = "default" | "destructive" | "warning";

export interface SourceCardProps {
  children: React.ReactNode;
  className?: string;
  source: EditingInstance;
}

const statusIcons: Record<SourceCardStatus, typeof CheckCircle2> = {
  deleted: CircleAlert,
  failed: CircleAlert,
  loading: LoaderCircle,
  missing: CircleAlert,
  ready: CheckCircle2,
};

const statusBadgeClassNames: Record<SourceCardBadgeVariant, string> = {
  default: "bg-card/90 text-muted-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

const SourceCard = memo(function SourceCard({ children, className, source }: SourceCardProps) {
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourceStatus = useAppSelector(selectSourceStatus);

  const id = source.id;
  const active = id === activeInstanceId;
  const { displayName } = source.snapshot.source;
  const status = getSourceCardStatus(source, active, sourceStatus);
  const variant = getSourceCardVariant(status, active);

  return (
    <SourceCardContext.Provider value={source}>
      <SourceCardContextMenu>
        <Card
          aria-checked={active}
          aria-label={displayName}
          className={cn("group/source-card cursor-pointer", className)}
          data-active={active ? "true" : "false"}
          data-source-id={id}
          hoverable
          onClick={() => void dispatch(navigateToEditingInstance(id))}
          role="checkbox"
          tabIndex={0}
          variant={variant}
        >
          {children}
        </Card>
      </SourceCardContextMenu>
    </SourceCardContext.Provider>
  );
});

function SourceCardThumbnail({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const source = useSourceCardSource();

  const { t } = useTranslation();

  const id = source.id;
  const { displayName } = source.snapshot.source;
  const thumbnail = useAppSelector((state) => selectImportedSourceThumbnail(state, id));
  const thumbnailUrl = thumbnail?.status === "ready" ? thumbnail.value.url : undefined;
  const thumbnailLoading =
    !thumbnailUrl &&
    source.sourceAvailability === "available" &&
    (thumbnail === undefined || thumbnail.status === "loading");

  const durationMicros = source.media?.durationMicros;

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden bg-muted text-muted-foreground shadow-md",
        className,
      )}
    >
      {thumbnailUrl ? (
        <>
          <img
            alt={`${displayName} thumbnail`}
            aria-label={`${displayName} thumbnail`}
            className="size-full object-cover transition-transform"
            src={thumbnailUrl}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none invisible absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full border border-input bg-background text-foreground group-hover/source-card:visible"
          >
            <Play aria-hidden="true" className="size-4" />
          </span>
        </>
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

      {durationMicros !== undefined ? (
        <Badge
          className="absolute right-2 bottom-2 border-0 bg-black/75 px-1.5 font-medium text-white"
          size="sm"
        >
          {formatDuration(durationMicros)}
        </Badge>
      ) : null}

      {children}
    </div>
  );
}

function SourceCardStatusBadge({ className }: { className?: string }) {
  const source = useSourceCardSource();

  const { t } = useTranslation();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourceStatus = useAppSelector(selectSourceStatus);

  const id = source.id;
  const active = id === activeInstanceId;
  const status = getSourceCardStatus(source, active, sourceStatus);
  const statusLabel = getSourceCardStatusLabel(t, status);
  const variant = getSourceCardBadgeVariant(status);

  const StatusIcon = statusIcons[status];

  if (status === "ready") return;

  return (
    <Badge
      className={cn("gap-1 backdrop-blur-sm", statusBadgeClassNames[variant], className)}
      size="xs"
      variant="outline"
    >
      <StatusIcon
        aria-hidden="true"
        className={status === "loading" ? "animate-spin" : undefined}
      />
      {statusLabel}
    </Badge>
  );
}

function SourceCardTitle({ className }: { className?: string }) {
  const source = useSourceCardSource();

  const { displayName } = source.snapshot.source;

  return (
    <CardTitle className={cn("truncate text-sm", className)} title={displayName}>
      {displayName}
    </CardTitle>
  );
}

function SourceCardDescription({ className }: { className?: string }) {
  const source = useSourceCardSource();

  const { sourcePath } = source.snapshot.source;

  return (
    <CardDescription className={cn("truncate", className)} title={sourcePath}>
      {formatSourcePath(sourcePath)}
    </CardDescription>
  );
}

function SourceCardMetadata({ className }: { className?: string }) {
  const source = useSourceCardSource();
  const { i18n, t } = useTranslation();
  const now = useRelativeTimeNow();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const unknown = t("common.status.unknown");
  const fileSize = formatBytes(source.media?.sizeBytes, unknown);
  const updatedAt = formatRelativeTime(
    source.snapshot.source.updatedAtMicros,
    locale,
    unknown,
    now,
  );

  const updatedAtExact = formatDateTime(source.snapshot.source.updatedAtMicros, locale, unknown);

  return (
    <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help truncate focus-visible:outline-none" tabIndex={0}>
            {fileSize}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("source.labels.metadata.fileSize")}: {fileSize}
        </TooltipContent>
      </Tooltip>
      <span aria-hidden="true">·</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help truncate focus-visible:outline-none" tabIndex={0}>
            {updatedAt}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("source.labels.metadata.updatedAt")}: {updatedAtExact}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * @name SourceCardActions
 * @description Builds the dropdown menu for one source card using the shared source menu actions.
 */
function SourceCardActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const source = useSourceCardSource();
  const [menuOpen, setMenuOpen] = useState(false);

  const { t } = useTranslation();

  const { sourcePath } = source.snapshot.source;
  const showRestore = source.sourceAvailability === "deleted";
  const revealLabel = getRevealLabel(t);

  return (
    <CardAction
      className={cn(className, menuOpen ? "visible" : undefined)}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu onOpenChange={setMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
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

          <CloseSource source={source}>
            <DropdownMenuItem inset>
              <DropdownMenuIcon>
                <X aria-hidden="true" />
              </DropdownMenuIcon>

              {t("app.actions.closeFile")}
            </DropdownMenuItem>
          </CloseSource>

          <DropdownMenuSeparator />

          {showRestore ? (
            <RestoreSource source={source}>
              <DropdownMenuItem inset variant="success">
                <DropdownMenuIcon>
                  <RotateCcw aria-hidden="true" />
                </DropdownMenuIcon>

                {t("app.actions.restore")}
              </DropdownMenuItem>
            </RestoreSource>
          ) : (
            <DeleteSource source={source}>
              <DropdownMenuItem inset variant="destructive">
                <DropdownMenuIcon>
                  <Trash2 aria-hidden="true" />
                </DropdownMenuIcon>

                {t("app.actions.deleteFile")}
              </DropdownMenuItem>
            </DeleteSource>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </CardAction>
  );
}

/**
 * @name SourceCardContextMenu
 * @description Builds the context menu for one source card, including its file lifecycle actions.
 */
function SourceCardContextMenu({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const source = useSourceCardSource();

  const { sourcePath } = source.snapshot.source;
  const showRestore = source.sourceAvailability === "deleted";
  const revealLabel = getRevealLabel(t);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

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

        <CloseSource source={source}>
          <ContextMenuItem inset>
            <ContextMenuIcon>
              <X aria-hidden="true" />
            </ContextMenuIcon>
            {t("app.actions.closeFile")}
          </ContextMenuItem>
        </CloseSource>

        <ContextMenuSeparator />

        {showRestore ? (
          <RestoreSource source={source}>
            <ContextMenuItem inset variant="success">
              <ContextMenuIcon>
                <RotateCcw aria-hidden="true" />
              </ContextMenuIcon>
              {t("app.actions.restore")}
            </ContextMenuItem>
          </RestoreSource>
        ) : (
          <DeleteSource source={source}>
            <ContextMenuItem inset variant="destructive">
              <ContextMenuIcon>
                <Trash2 aria-hidden="true" />
              </ContextMenuIcon>
              {t("app.actions.deleteFile")}
            </ContextMenuItem>
          </DeleteSource>
        )}
      </ContextMenuContent>
    </ContextMenu>
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

function getSourceCardVariant(status: SourceCardStatus, active: boolean): SourceCardVariant {
  if (active) return "active";

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

function getSourceCardBadgeVariant(status: SourceCardStatus): SourceCardBadgeVariant {
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

const SourceCardContext = createContext<EditingInstance | null>(null);

function useSourceCardSource() {
  const context = useContext(SourceCardContext);

  if (!context) {
    throw new Error(
      "SourceCardThumbnail, SourceCardDetails, SourceCardTitle, SourceCardDescription and SourceCardMetadata must be used within SourceCard",
    );
  }

  return context;
}

export {
  SourceCard,
  SourceCardActions,
  SourceCardDescription,
  SourceCardMetadata,
  SourceCardStatusBadge,
  SourceCardThumbnail,
  SourceCardTitle,
};
