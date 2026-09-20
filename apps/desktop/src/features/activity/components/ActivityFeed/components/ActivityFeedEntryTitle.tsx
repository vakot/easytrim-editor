import { MarkerTitle } from "@/components/ui/marker";
import { RelativeTimestamp } from "@/components/ui/relative-timestamp";

import { cn } from "@/lib/class-names.utils";

import type { ActivityEntry } from "../../../lib/activity-projection";

interface ActivityFeedEntryTitleProps {
  className?: string;
  entry: ActivityEntry;
}

export function ActivityFeedEntryTitle({ className, entry }: ActivityFeedEntryTitleProps) {
  return (
    <MarkerTitle className={cn("flex min-w-0 flex-nowrap items-center gap-1", className)}>
      <span className={cn("truncate", entry.status === "pending" && "shimmer")}>{entry.title}</span>
      <span>·</span>
      <RelativeTimestamp
        className="shrink-0 text-muted-foreground"
        timestamp={toTimestampMicros(entry.startedAt)}
      />
    </MarkerTitle>
  );
}

function toTimestampMicros(timestamp: string): number | undefined {
  const timestampMs = Date.parse(timestamp);
  return Number.isNaN(timestampMs) ? undefined : timestampMs * 1_000;
}
