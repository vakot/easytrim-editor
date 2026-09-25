import { AnimatePresence } from "motion/react";

import { Marker, MarkerContent } from "@/components/ui/marker";
import { RelativeTimestamp } from "@/components/ui/relative-timestamp";

import { cn } from "@/lib/class-names.utils";

import {
  type ActivityAction,
  type ActivitySessionGroup,
  type ActivitySessionLabels,
  getActivitySessionPresentation,
  groupActivityEntriesByBranch,
} from "../../../lib/activity-projection";
import { toTimestampMicros } from "../lib/activity-feed.utils";

import { ActivityFeedBranch } from "./ActivityFeedBranch";
import { ActivityFeedEntry } from "./ActivityFeedEntry";

interface ActivityFeedGroupProps {
  currentAppVersion: string;
  currentDateTime: Date;
  group: ActivitySessionGroup;
  isBranch: boolean;
  isCompact: boolean;
  locale: string;
  onAction?: (action: ActivityAction) => void;
  sessionLabels: ActivitySessionLabels;
}

const sessionSeparatorClassNames = {
  current: "font-semibold text-destructive before:bg-destructive after:bg-destructive",
  default: undefined,
  warning: "font-medium text-warning before:bg-warning after:bg-warning",
} satisfies Record<"current" | "default" | "warning", string | undefined>;

function ActivityFeedGroup({
  currentAppVersion,
  currentDateTime,
  group,
  isBranch,
  isCompact,
  locale,
  onAction,
  sessionLabels,
}: ActivityFeedGroupProps) {
  const presentation = getActivitySessionPresentation(
    group,
    currentAppVersion,
    currentDateTime,
    locale,
    sessionLabels,
  );

  return (
    <div className={cn("flex flex-col", isCompact ? "gap-1" : isBranch ? "gap-5" : "gap-3")}>
      <div className="sticky top-0 z-10 bg-card">
        <Marker className={sessionSeparatorClassNames[presentation.tone]} variant="separator">
          <MarkerContent className="flex-row items-center gap-1 text-xs font-medium">
            {presentation.label}
            {presentation.timestamp ? (
              <>
                <span>·</span>
                <RelativeTimestamp
                  className="text-muted-foreground"
                  timestamp={toTimestampMicros(presentation.timestamp)}
                />
              </>
            ) : null}
          </MarkerContent>
        </Marker>
      </div>

      {isBranch ? (
        <AnimatePresence initial={false}>
          {groupActivityEntriesByBranch(group.entries).map((item) =>
            item.kind === "branch" ? (
              <ActivityFeedBranch branch={item.branch} key={item.branch.id} onAction={onAction} />
            ) : (
              <ActivityFeedEntry entry={item.entry} key={item.entry.id} onAction={onAction} />
            ),
          )}
        </AnimatePresence>
      ) : (
        <AnimatePresence initial={false}>
          {group.entries.map((entry) => (
            <ActivityFeedEntry
              compact={isCompact}
              entry={entry}
              key={entry.id}
              onAction={onAction}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

export { ActivityFeedGroup };
