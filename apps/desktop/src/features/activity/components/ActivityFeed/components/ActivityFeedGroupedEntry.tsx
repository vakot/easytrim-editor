import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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
  const shouldReduceMotion = useReducedMotion() === true;
  const { i18n, t } = useTranslation();
  const now = useRelativeTimeNow();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const timestamp = toTimestampMicros(group.latestEntryAt);
  const relativeTime = formatRelativeTime(timestamp, locale, t("common.status.unknown"), now);
  const Icon = group.icon;
  const groupLength = group.entries.length;

  return (
    <Marker
      asChild
      className={compact ? "h-6 items-center text-xs" : "min-h-6 items-start text-xs"}
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
        layout={shouldReduceMotion ? false : "position"}
        transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" }}
      >
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
      </motion.div>
    </Marker>
  );
}

export { ActivityFeedGroupedEntry };
