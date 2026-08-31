import { Film, RotateCcw, Scissors, Trash2 } from "lucide-react";
import {
  type ComponentType,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";

import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  getCurrentSessionDiagnosticsSnapshot,
  subscribeToCurrentSessionDiagnostics,
} from "@/lib/diagnostics";

import {
  type ActivityEntry,
  type ActivityKind,
  type ActivityProjectionLabels,
  groupActivityEntries,
  projectActivityEvents,
} from "./activity-projection";

const activityIcons: Record<ActivityKind, ComponentType> = {
  "fast-cut-completed": Scissors,
  "file-deleted": Trash2,
  "file-restored": RotateCcw,
  "render-completed": Film,
};

interface ActivityFeedViewProps {
  dateLabels: { today: string; yesterday: string };
  emptyLabel: string;
  entries: readonly ActivityEntry[];
  locale: string;
  now: number;
  title: string;
}

export function ActivityFeed() {
  const { i18n, t } = useTranslation();
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
      fastCutCompleted: t("activity.entries.fastCutCompleted"),
      fileDeleted: t("activity.entries.fileDeleted"),
      fileRestored: t("activity.entries.fileRestored"),
      renderCompleted: t("activity.entries.renderCompleted"),
    }),
    [t],
  );

  const entries = useMemo(
    () => projectActivityEvents(diagnosticSnapshot.events, labels),
    [diagnosticSnapshot, labels],
  );

  return (
    <ActivityFeedView
      dateLabels={{
        today: t("activity.dates.today"),
        yesterday: t("activity.dates.yesterday"),
      }}
      emptyLabel={t("activity.messages.empty")}
      entries={entries}
      locale={i18n.resolvedLanguage ?? i18n.language}
      now={currentTime}
      title={t("activity.labels.title")}
    />
  );
}

export function ActivityFeedView({
  dateLabels,
  emptyLabel,
  entries,
  locale,
  now,
  title,
}: ActivityFeedViewProps) {
  const titleId = useId();
  const groups = useMemo(() => groupActivityEntries(entries), [entries]);
  const currentDate = new Date(now);
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }),
    [locale],
  );

  return (
    <section aria-labelledby={titleId} className="flex h-full min-h-0 flex-col">
      <h2 className="px-3 py-2 text-sm font-semibold text-foreground" id={titleId}>
        {title}
      </h2>
      {groups.length === 0 ? (
        <p className="mx-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-3 px-3 pb-3">
            {groups.map((group) => (
              <div className="grid gap-2" key={group.dateKey}>
                <Marker variant="separator">
                  <MarkerContent className="text-xs font-medium">
                    {formatDateLabel(group.date, currentDate, locale, dateLabels)}
                  </MarkerContent>
                </Marker>
                {group.entries.map((entry) => (
                  <ActivityFeedEntry entry={entry} key={entry.id} timeFormatter={timeFormatter} />
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
  timeFormatter,
}: {
  entry: ActivityEntry;
  timeFormatter: Intl.DateTimeFormat;
}) {
  const Icon = activityIcons[entry.kind];
  return (
    <Marker className="items-start" variant="border">
      <MarkerIcon className="mt-0.5 text-foreground">
        <Icon />
      </MarkerIcon>
      <MarkerContent className="flex flex-1 items-start justify-between gap-2">
        <span className="text-foreground">{entry.title}</span>
        <time className="shrink-0 text-xs" dateTime={entry.timestamp}>
          {timeFormatter.format(new Date(entry.timestamp))}
        </time>
      </MarkerContent>
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
