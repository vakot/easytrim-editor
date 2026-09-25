import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Marker, MarkerContent, MarkerIcon, MarkerTitle } from "@/components/ui/marker";

import { formatRelativeTime } from "@/lib/date-time.utils";
import { useRelativeTimeNow } from "@/lib/hooks/use-relative-time";

import type { ActivityEntry } from "../../../lib/activity-projection";
import { toTimestampMicros } from "../lib/activity-feed.utils";

interface GroupedActivity {
  entries: readonly ActivityEntry[];
  icon: LucideIcon;
  latestEntryAt: string;
  title: string;
}

interface ActivityFeedGroupedEntryProps {
  compact?: boolean;
  group: GroupedActivity;
}

function ActivityFeedGroupedEntry({ compact = false, group }: ActivityFeedGroupedEntryProps) {
  const { i18n, t } = useTranslation();
  const now = useRelativeTimeNow();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const timestamp = toTimestampMicros(group.latestEntryAt);
  const relativeTime = formatRelativeTime(timestamp, locale, t("common.status.unknown"), now);
  const Icon = group.icon;
  const groupLength = group.entries.length;

  return (
    <Marker className={compact ? "h-6 items-center text-xs" : "min-h-6 items-start text-xs"}>
      <MarkerIcon className="relative">
        <Icon />
        <Icon className="absolute top-1 opacity-60" />
        {groupLength > 2 && <Icon className="absolute top-2 opacity-20" />}
      </MarkerIcon>

      <MarkerContent className={compact ? "flex-row flex-nowrap items-center gap-1" : undefined}>
        <MarkerTitle className="flex min-w-0 flex-nowrap items-center gap-1 text-foreground">
          <span className="truncate">{group.title}</span>
          <span>·</span>
          <time className="shrink-0 text-muted-foreground" dateTime={group.latestEntryAt}>
            {relativeTime}
          </time>
        </MarkerTitle>
      </MarkerContent>
    </Marker>
  );
}

export { ActivityFeedGroupedEntry };
