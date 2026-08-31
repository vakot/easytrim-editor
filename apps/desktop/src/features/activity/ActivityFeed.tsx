import type { TFunction } from "i18next";
import {
  CircleAlert,
  CircleX,
  ExternalLink,
  Film,
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
import { selectExportQueue } from "@/app/store/slices/export-slice";
import { restoreExportSourceRequested } from "@/app/store/thunks/export-thunks";
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
  type ActivityEntry,
  type ActivityKind,
  type ActivityProjectionLabels,
  type ActivitySessionLabels,
  type ActivityStatus,
  getActivitySessionPresentation,
  groupActivityEntriesBySession,
  projectActivityEvents,
  resolveAvailableActivityActions,
} from "./activity-projection";

const activityIcons: Record<ActivityKind, LucideIcon> = {
  "fast-cut": Scissors,
  "file-deleted": Trash2,
  "file-restored": RotateCcw,
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
  const exportQueue = useAppSelector(selectExportQueue);
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
      fastCutting: t("app.status.fastCutting"),
      fileDeleted: t("app.status.fileDeleted"),
      fileRestored: t("app.status.fileRestored"),
      renderCompleted: t("app.status.renderCompleted"),
      renderCancelled: t("app.status.renderCancelled"),
      renderFailed: t("app.status.renderFailed"),
      renderInterrupted: t("app.status.renderInterrupted"),
      rendering: t("app.status.rendering"),
    }),
    [t],
  );

  const restorableSourceIds = useMemo(
    () =>
      new Set(
        exportQueue
          .filter((item) => item.status === "completed" && item.sourceDeleted)
          .map((item) => item.id),
      ),
    [exportQueue],
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
        restorableSourceIds,
      ),
    [diagnosticSnapshot, historySnapshot, labels, restorableSourceIds],
  );

  const currentSession = getCurrentDiagnosticSessionMetadata();
  const sessions = currentSession
    ? [currentSession, ...historySnapshot.sessions]
    : historySnapshot.sessions;

  const handleAction = useCallback(
    (action: ActivityAction) => {
      if (action.kind === "restore") {
        void dispatch(restoreExportSourceRequested(action.targetId));
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
      <h3
        className="mx-3 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        id={titleId}
      >
        {t("app.labels.activityFeed")}
      </h3>

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
          <div className="grid gap-3 pr-2 pb-3 pl-3">
            {groups.map((group) => {
              const presentation = getActivitySessionPresentation(
                group,
                currentAppVersion,
                currentDateTime,
                locale,
                sessionLabels,
              );

              return (
                <div className="flex flex-col gap-3" key={group.sessionId}>
                  <Marker
                    className={cn(sessionSeparatorClassNames[presentation.tone])}
                    variant="separator"
                  >
                    <MarkerContent className="text-xs font-medium">
                      {presentation.label}
                    </MarkerContent>
                  </Marker>
                  {group.entries.map((entry) => (
                    <ActivityFeedEntry
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

function ActivityFeedEntry({
  entry,
  onAction,
  timeFormatter,
}: {
  entry: ActivityEntry;
  onAction?: (action: ActivityAction) => void;
  timeFormatter: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation();

  const statusPresentation = activityStatusPresentation[entry.status];
  const Icon = statusPresentation.icon ?? activityIcons[entry.kind];
  const action = entry.action;
  const actionPresentation = action ? activityActionPresentation[action.kind] : undefined;
  const ActionIcon = actionPresentation?.icon;
  const actionLabel = actionPresentation?.getLabel(t);
  const normalizedSourcePath = formatSourcePath(entry.path ?? "");

  const hasAction = action && actionLabel && ActionIcon && onAction;

  return (
    <Marker className="items-start text-xs">
      <MarkerIcon className={statusPresentation.className}>
        <Icon
          aria-hidden="true"
          className={entry.status === "pending" ? "animate-spin" : undefined}
        />
      </MarkerIcon>
      <MarkerContent className={cn(!hasAction && "pr-7")}>
        <div className="flex justify-between gap-2 text-foreground">
          {entry.title}
          <time className="shrink-0 text-muted-foreground" dateTime={entry.startedAt}>
            {timeFormatter.format(new Date(entry.startedAt))}
          </time>
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
      {hasAction ? (
        <MarkerAction>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={actionLabel}
                onClick={() => onAction(action)}
                size="icon-xs"
                variant="outline"
              >
                <ActionIcon aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{actionLabel}</TooltipContent>
          </Tooltip>
        </MarkerAction>
      ) : null}
    </Marker>
  );
}
