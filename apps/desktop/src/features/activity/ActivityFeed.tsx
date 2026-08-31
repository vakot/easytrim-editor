import type { TFunction } from "i18next";
import { ExternalLink, Film, type LucideIcon, RotateCcw, Scissors, Trash2 } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportQueue } from "@/app/store/slices/export-slice";
import { restoreExportSourceRequested } from "@/app/store/thunks/export-thunks";
import { formatSourcePath } from "@/features/source";
import {
  getCurrentSessionDiagnosticsSnapshot,
  subscribeToCurrentSessionDiagnostics,
} from "@/lib/diagnostics";
import { openFileLocation } from "@/lib/tauri/media";

import {
  type ActivityAction,
  type ActivityEntry,
  type ActivityKind,
  type ActivityProjectionLabels,
  groupActivityEntries,
  projectActivityEvents,
} from "./activity-projection";

const activityIcons: Record<ActivityKind, LucideIcon> = {
  "fast-cut-completed": Scissors,
  "file-deleted": Trash2,
  "file-restored": RotateCcw,
  "render-completed": Film,
};

const activityActionPresentation = {
  open: { getLabel: (t: TFunction) => t("app.actions.open"), icon: ExternalLink },
  restore: { getLabel: (t: TFunction) => t("app.actions.restore"), icon: RotateCcw },
} satisfies Record<
  ActivityAction["kind"],
  { getLabel: (t: TFunction) => string; icon: LucideIcon }
>;

interface ActivityFeedViewProps {
  entries: readonly ActivityEntry[];
  now: number;
  onAction?: (action: ActivityAction) => void;
}

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

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const labels = useMemo<ActivityProjectionLabels>(
    () => ({
      fastCutCompleted: t("app.status.fastCutCompleted"),
      fileDeleted: t("app.status.fileDeleted"),
      fileRestored: t("app.status.fileRestored"),
      renderCompleted: t("app.status.renderCompleted"),
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
      projectActivityEvents(diagnosticSnapshot.events, labels).map((entry) =>
        entry.action?.kind === "restore" && !restorableSourceIds.has(entry.action.targetId)
          ? { ...entry, action: undefined }
          : entry,
      ),
    [diagnosticSnapshot, labels, restorableSourceIds],
  );

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

  return <ActivityFeedView entries={entries} now={currentTime} onAction={handleAction} />;
}

export function ActivityFeedView({ entries, now, onAction }: ActivityFeedViewProps) {
  const { i18n, t } = useTranslation();

  const locale = i18n.resolvedLanguage ?? i18n.language;

  const titleId = useId();
  const groups = useMemo(() => groupActivityEntries(entries), [entries]);
  const currentDate = new Date(now);

  const dateLabels = {
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
        {t("app.labels.activity")}
      </h3>

      {groups.length === 0 ? (
        <p className="mx-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {t("app.messages.activityEmpty")}
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-3 px-3 pb-3">
            {groups.map((group) => (
              <div className="flex flex-col gap-3" key={group.dateKey}>
                <Marker variant="separator">
                  <MarkerContent className="text-xs font-medium">
                    {formatDateLabel(group.date, currentDate, locale, dateLabels)}
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
            ))}
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

  const Icon = activityIcons[entry.kind];
  const action = entry.action;
  const actionPresentation = action ? activityActionPresentation[action.kind] : undefined;
  const ActionIcon = actionPresentation?.icon;
  const actionLabel = actionPresentation?.getLabel(t);
  const normalizedSourcePath = formatSourcePath(entry.path ?? "");

  return (
    <Marker className="items-start text-xs">
      <MarkerIcon className="text-muted-foreground">
        <Icon />
      </MarkerIcon>
      <MarkerContent>
        <div className="text-foreground">
          {entry.title}{" "}
          <span className="text-muted-foreground">
            <span aria-hidden="true" className="shrink-0">
              ·{" "}
            </span>
            <time className="shrink-0" dateTime={entry.timestamp}>
              {timeFormatter.format(new Date(entry.timestamp))}
            </time>
          </span>
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
      {action && actionLabel && ActionIcon && onAction ? (
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

function formatDateLabel(
  date: Date,
  currentDate: Date,
  locale: string,
  labels: { today: string; yesterday: string },
): string {
  const dayDifference = calendarDayDifference(currentDate, date);
  if (dayDifference === 0) return labels.today;
  if (dayDifference === 1) return labels.yesterday;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === currentDate.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function calendarDayDifference(later: Date, earlier: Date): number {
  const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const earlierUtc = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((laterUtc - earlierUtc) / 86_400_000);
}
