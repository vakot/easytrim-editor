import type { TFunction } from "i18next";
import {
  CircleAlert,
  CircleX,
  ExternalLink,
  FileVideo,
  Film,
  FolderOpen,
  GitBranch,
  Info,
  LoaderCircle,
  type LucideIcon,
  RotateCcw,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Marker,
  MarkerAction,
  MarkerContent,
  MarkerDescription,
  MarkerIcon,
} from "@/components/ui/marker";
import { ResizablePanelControl } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectActivityFeedView } from "@/app/store/slices/preferences-slice";
import { restoreSourceFileRequested } from "@/app/store/thunks/source-media-thunks";
import { formatSourcePath } from "@/features/source";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { cn } from "@/lib/class-names.utils";
import {
  getCurrentDiagnosticSessionId,
  getCurrentDiagnosticSessionMetadata,
  getCurrentSessionDiagnosticsSnapshot,
  subscribeToCurrentSessionDiagnostics,
} from "@/lib/diagnostics";
import {
  getPersistedDiagnosticsHistorySnapshot,
  loadPersistedDiagnosticsHistory,
  subscribeToPersistedDiagnosticsHistory,
} from "@/lib/diagnostics-history";
import type { DiagnosticSessionMetadata } from "@/lib/tauri/diagnostics.types";
import { openFileLocation } from "@/lib/tauri/media";

import {
  type ActivityAction,
  type ActivityBranch,
  type ActivityEntry,
  type ActivityKind,
  type ActivityProjectionLabels,
  type ActivitySessionLabels,
  type ActivityStatus,
  getActivitySessionPresentation,
  groupActivityEntriesByBranch,
  groupActivityEntriesBySession,
  projectActivityEvents,
  resolveAvailableActivityActions,
} from "./activity-projection";

const activityIcons: Record<ActivityKind, LucideIcon> = {
  "fast-cut": Scissors,
  "file-deleted": Trash2,
  "file-restored": RotateCcw,
  "files-imported": FileVideo,
  "folders-imported": FolderOpen,
  render: Film,
};

const activityStatusPresentation: Record<ActivityStatus, { className: string; icon?: LucideIcon }> =
  {
    cancelled: { className: "text-muted-foreground", icon: CircleX },
    completed: { className: "text-muted-foreground" },
    failed: { className: "text-destructive", icon: CircleAlert },
    interrupted: { className: "text-destructive", icon: CircleAlert },
    pending: { className: "text-primary", icon: LoaderCircle },
  };

const activityActionPresentation = {
  open: { getLabel: (t: TFunction) => t("app.actions.open"), icon: ExternalLink },
  restore: { getLabel: (t: TFunction) => t("app.actions.restore"), icon: RotateCcw },
} satisfies Record<
  ActivityAction["kind"],
  { getLabel: (t: TFunction) => string; icon: LucideIcon }
>;

interface ActivityFeedViewProps {
  currentAppVersion: string;
  currentSessionId: string | null;
  entries: readonly ActivityEntry[];
  now: number;
  onAction?: (action: ActivityAction) => void;
  sessions: readonly DiagnosticSessionMetadata[];
}

const sessionSeparatorClassNames = {
  current: "font-semibold text-destructive before:bg-destructive after:bg-destructive",
  default: undefined,
  warning: "font-medium text-warning before:bg-warning after:bg-warning",
} satisfies Record<"current" | "default" | "warning", string | undefined>;

export function ActivityFeed() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const diagnosticSnapshot = useSyncExternalStore(
    subscribeToCurrentSessionDiagnostics,
    getCurrentSessionDiagnosticsSnapshot,
    getCurrentSessionDiagnosticsSnapshot,
  );

  const historySnapshot = useSyncExternalStore(
    subscribeToPersistedDiagnosticsHistory,
    getPersistedDiagnosticsHistorySnapshot,
    getPersistedDiagnosticsHistorySnapshot,
  );

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    void loadPersistedDiagnosticsHistory();
  }, []);

  const labels = useMemo<ActivityProjectionLabels>(
    () => ({
      fastCutCompleted: t("app.status.fastCutCompleted"),
      fastCutCancelled: t("app.status.fastCutCancelled"),
      fastCutFailed: t("app.status.fastCutFailed"),
      fastCutInterrupted: t("app.status.fastCutInterrupted"),
      fastCutStarted: t("app.status.fastCutStarted"),
      fastCutting: t("app.status.fastCutting"),
      fileDeleteCancelled: t("app.status.fileDeleteCancelled"),
      fileDeleteFailed: t("app.status.fileDeleteFailed"),
      fileDeleteInterrupted: t("app.status.fileDeleteInterrupted"),
      fileDeleting: t("app.status.fileDeleting"),
      fileDeleted: t("app.status.fileDeleted"),
      fileRestoreCancelled: t("app.status.fileRestoreCancelled"),
      fileRestoreFailed: t("app.status.fileRestoreFailed"),
      fileRestoreInterrupted: t("app.status.fileRestoreInterrupted"),
      fileRestoring: t("app.status.fileRestoring"),
      fileRestored: t("app.status.fileRestored"),
      importOpenedFiles: (count) => t("app.status.openedFiles", { count }),
      importOpenedFilesFromFolders: (fileCount, folderCount) =>
        `${t("app.status.openedFiles", { count: fileCount })} ${t("app.status.fromFolders", { count: folderCount })}`,
      renderCompleted: t("app.status.renderCompleted"),
      renderCancelled: t("app.status.renderCancelled"),
      renderFailed: t("app.status.renderFailed"),
      renderInterrupted: t("app.status.renderInterrupted"),
      renderStarted: t("app.status.renderStarted"),
      rendering: t("app.status.rendering"),
    }),
    [t],
  );

  const entries = useMemo(
    () =>
      resolveAvailableActivityActions(
        projectActivityEvents(
          [...historySnapshot.events, ...diagnosticSnapshot.events],
          labels,
          getCurrentDiagnosticSessionId(),
        ),
        getCurrentDiagnosticSessionId(),
      ),
    [diagnosticSnapshot, historySnapshot, labels],
  );

  const currentSession = getCurrentDiagnosticSessionMetadata();
  const sessions = currentSession
    ? [currentSession, ...historySnapshot.sessions]
    : historySnapshot.sessions;

  const handleAction = useCallback(
    (action: ActivityAction) => {
      if (action.kind === "restore") {
        void dispatch(
          restoreSourceFileRequested({
            itemId: action.targetId,
            sourcePath: action.path,
          }),
        );
        return;
      }
      void openFileLocation(action.path).catch(() => undefined);
    },
    [dispatch],
  );

  return (
    <ActivityFeedView
      currentAppVersion={getCurrentVersion()}
      currentSessionId={currentSession?.sessionId ?? null}
      entries={entries}
      now={currentTime}
      onAction={handleAction}
      sessions={sessions}
    />
  );
}

export function ActivityFeedView({
  currentAppVersion,
  currentSessionId,
  entries,
  now,
  onAction,
  sessions,
}: ActivityFeedViewProps) {
  const { i18n, t } = useTranslation();

  const activityFeedView = useAppSelector(selectActivityFeedView);
  const isCompact = activityFeedView === "compact";
  const isBranch = activityFeedView === "branch";

  const locale = i18n.resolvedLanguage ?? i18n.language;

  const titleId = useId();
  const groups = useMemo(
    () => groupActivityEntriesBySession(entries, sessions, currentSessionId),
    [currentSessionId, entries, sessions],
  );

  const currentDateTime = new Date(now);

  const sessionLabels: ActivitySessionLabels = {
    now: t("app.labels.now"),
    today: t("app.labels.today"),
    yesterday: t("app.labels.yesterday"),
  };

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }),
    [locale],
  );

  return (
    <section aria-labelledby={titleId} className="flex h-full min-h-0 flex-col gap-2">
      <div className="mx-3 flex items-center gap-1.5">
        <h3
          className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
          id={titleId}
        >
          {t("app.labels.activityFeed")}
        </h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label={t("app.accessibility.activityFeedPrivacy")}
              className="inline-flex size-4 items-center justify-center text-primary"
              type="button"
            >
              <Info aria-hidden="true" className="size-3.5 text-primary" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("app.tooltips.activityFeedPrivacy")}</TooltipContent>
        </Tooltip>
      </div>

      <ResizablePanelControl panelId="workspace-activity">
        <Button
          className="absolute top-2 right-3 text-secondary-foreground"
          size="icon-xs"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
      </ResizablePanelControl>

      {groups.length === 0 ? (
        <p className="mx-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {t("app.messages.activityEmpty")}
        </p>
      ) : (
        <ScrollArea className="mr-1 min-h-0 flex-1">
          <div className={cn("grid pr-2 pl-3", isCompact ? "gap-1" : "gap-3")}>
            {groups.map((group) => {
              const presentation = getActivitySessionPresentation(
                group,
                currentAppVersion,
                currentDateTime,
                locale,
                sessionLabels,
              );

              return (
                <div
                  className={cn("flex flex-col", isCompact ? "gap-1" : "gap-3")}
                  key={group.sessionId}
                >
                  <Marker
                    className={cn(sessionSeparatorClassNames[presentation.tone])}
                    variant="separator"
                  >
                    <MarkerContent className="text-xs font-medium">
                      {presentation.label}
                    </MarkerContent>
                  </Marker>
                  {isBranch
                    ? groupActivityEntriesByBranch(group.entries).map((item) =>
                        item.kind === "branch" ? (
                          <ActivityFeedBranch
                            branch={item.branch}
                            key={item.branch.id}
                            onAction={onAction}
                            timeFormatter={timeFormatter}
                          />
                        ) : (
                          <ActivityFeedEntry
                            entry={item.entry}
                            key={item.entry.id}
                            onAction={onAction}
                            timeFormatter={timeFormatter}
                          />
                        ),
                      )
                    : group.entries.map((entry) => (
                        <ActivityFeedEntry
                          compact={isCompact}
                          entry={entry}
                          key={entry.id}
                          onAction={onAction}
                          timeFormatter={timeFormatter}
                        />
                      ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </section>
  );
}

function ActivityFeedBranch({
  branch,
  onAction,
  timeFormatter,
}: {
  branch: ActivityBranch;
  onAction?: (action: ActivityAction) => void;
  timeFormatter: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation();
  const normalizedSourcePath = formatSourcePath(branch.path ?? "");
  const filename = normalizedSourcePath.split(/[\\/]/).pop() || t("app.labels.file");

  return (
    <div className="relative pl-5">
      <div aria-hidden="true" className="absolute inset-y-3 left-2 w-px bg-border" />
      <div className="relative flex min-w-0 items-start gap-2 pb-1">
        <span
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground [&_svg:not([class*='size-'])]:size-4"
        >
          <GitBranch />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs text-foreground" title={filename}>
            {filename}
          </span>
          {normalizedSourcePath ? (
            <span
              className="min-w-0 truncate text-xs text-muted-foreground"
              title={normalizedSourcePath}
            >
              {normalizedSourcePath}
            </span>
          ) : null}
        </span>
      </div>
      <div className="grid gap-1">
        {branch.entries.map((entry) => (
          <div
            className={cn(
              "relative pl-4",
              "before:absolute before:top-1/2 before:left-0 before:h-px before:w-3 before:bg-border",
            )}
            key={entry.id}
          >
            <ActivityFeedEntry
              branch
              compact
              entry={entry}
              onAction={onAction}
              timeFormatter={timeFormatter}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeedEntry({
  branch = false,
  compact = false,
  entry,
  onAction,
  timeFormatter,
}: {
  branch?: boolean;
  compact?: boolean;
  entry: ActivityEntry;
  onAction?: (action: ActivityAction) => void;
  timeFormatter: Intl.DateTimeFormat;
}) {
  const statusPresentation = activityStatusPresentation[entry.status];
  const Icon = statusPresentation.icon ?? activityIcons[entry.kind];
  const action = entry.action;
  const normalizedSourcePath = formatSourcePath(entry.path ?? "");
  const markerClassName = branch ? "text-muted-foreground" : statusPresentation.className;

  const showAction = !!action && onAction;

  if (compact) {
    return (
      <Marker className="h-6 items-center text-xs">
        <MarkerIcon className={markerClassName}>
          <Icon
            aria-hidden="true"
            className={entry.status === "pending" ? "animate-spin" : undefined}
          />
        </MarkerIcon>
        <MarkerContent className="min-w-0 flex-row flex-nowrap items-center gap-1">
          <ActivityFeedEntryTitle entry={entry} muted={branch} timeFormatter={timeFormatter} />
          {showAction && (
            <ActivityFeedEntryButton
              compact={compact}
              entry={entry}
              onClick={() => onAction(action)}
            />
          )}
        </MarkerContent>
      </Marker>
    );
  }

  return (
    <Marker className="items-start text-xs">
      <MarkerIcon className={markerClassName}>
        <Icon
          aria-hidden="true"
          className={entry.status === "pending" ? "animate-spin" : undefined}
        />
      </MarkerIcon>
      <MarkerContent>
        <div className="flex min-w-0 flex-nowrap items-center gap-1">
          <ActivityFeedEntryTitle entry={entry} timeFormatter={timeFormatter} />
        </div>
        <MarkerDescription>
          {entry.path ? (
            <>
              <span className="min-w-0 flex-1 truncate" title={normalizedSourcePath}>
                {normalizedSourcePath}
              </span>
            </>
          ) : null}
        </MarkerDescription>
      </MarkerContent>
      {showAction && (
        <MarkerAction>
          <ActivityFeedEntryButton
            compact={compact}
            entry={entry}
            onClick={() => onAction(action)}
          />
        </MarkerAction>
      )}
    </Marker>
  );
}

function ActivityFeedEntryTitle({
  entry,
  muted = false,
  timeFormatter,
}: {
  entry: ActivityEntry;
  muted?: boolean;
  timeFormatter: Intl.DateTimeFormat;
}) {
  return (
    <>
      <span
        className={cn(
          "truncate",
          muted ? "text-muted-foreground" : "text-foreground",
          entry.status === "pending" && "shimmer",
        )}
      >
        {entry.title}
      </span>
      <span>·</span>
      <time className="shrink-0 text-muted-foreground" dateTime={entry.startedAt}>
        {timeFormatter.format(new Date(entry.startedAt))}
      </time>
    </>
  );
}

function ActivityFeedEntryButton({
  compact = false,
  entry,
  onClick,
}: {
  compact?: boolean;
  entry: ActivityEntry;
  onClick?: () => void;
}) {
  const { t } = useTranslation();

  const action = entry.action;
  const actionPresentation = action ? activityActionPresentation[action.kind] : undefined;
  const actionLabel = actionPresentation?.getLabel(t);
  const ActionIcon = actionPresentation?.icon;

  const isValidAction = action && actionLabel && ActionIcon && onClick;

  if (!isValidAction) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={actionLabel}
          onClick={onClick}
          size="icon-xs"
          variant={compact ? "ghost" : "outline"}
        >
          <ActionIcon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{actionLabel}</TooltipContent>
    </Tooltip>
  );
}
