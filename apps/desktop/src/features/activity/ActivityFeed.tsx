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
  entries: readonly ActivityEntry[];
  now: number;
}

export function ActivityFeed() {
  const { t } = useTranslation();
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

  const entries = useMemo(
    () => projectActivityEvents(diagnosticSnapshot.events, labels),
    [diagnosticSnapshot, labels],
  );

  return <ActivityFeedView entries={entries} now={currentTime} />;
}

export function ActivityFeedView({ entries, now }: ActivityFeedViewProps) {
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
    <Marker className="items-center text-xs">
      <MarkerIcon className="text-muted-foreground">
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
