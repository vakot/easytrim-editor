import { CircleX } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";

import { Marker, MarkerContent } from "@/components/ui/marker";
import { RelativeTimestamp } from "@/components/ui/relative-timestamp";

import { cn } from "@/lib/class-names.utils";

import {
  type ActivityAction,
  type ActivityEntry,
  type ActivityGroup,
  type ActivitySessionDisplayGroup,
  type ActivitySessionItem,
  type ActivitySessionLabels,
  getActivitySessionPresentation,
  groupActivityEntriesByBranch,
  groupActivityEntriesForDisplay,
} from "../../../lib/activity-projection";
import { toTimestampMicros } from "../lib/activity-feed.utils";

import { ActivityFeedBranch } from "./ActivityFeedBranch";
import { ActivityFeedEntry } from "./ActivityFeedEntry";
import { ActivityFeedGroupedEntry } from "./ActivityFeedGroupedEntry";

interface ActivityFeedGroupProps {
  currentAppVersion: string;
  group: ActivitySessionDisplayGroup;
  isBranch: boolean;
  isCompact: boolean;
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
  group,
  isBranch,
  isCompact,
  onAction,
  sessionLabels,
}: ActivityFeedGroupProps) {
  const { t } = useTranslation();
  const presentation = getActivitySessionPresentation(group, currentAppVersion, sessionLabels);

  const activityItems = isBranch
    ? groupBranchActivityEntriesForDisplay(groupActivityEntriesByBranch(group.entries))
    : groupActivityEntriesForDisplay(group.entries);

  return (
    <div className={cn("flex flex-col", isCompact ? "gap-1" : isBranch ? "gap-5" : "gap-3")}>
      <div className="sticky top-0 z-10 bg-card">
        <Marker className={sessionSeparatorClassNames[presentation.tone]} variant="separator">
          <MarkerContent className="flex-row items-center gap-1 text-xs font-medium">
            {group.isCurrent ? (
              presentation.label
            ) : (
              <>
                {presentation.label ? (
                  <>
                    {presentation.label}
                    <span>·</span>
                  </>
                ) : null}
                <RelativeTimestamp
                  className="text-muted-foreground"
                  timestamp={toTimestampMicros(group.startedAt)}
                />
              </>
            )}
          </MarkerContent>
        </Marker>
      </div>

      <AnimatePresence initial={false}>
        {activityItems.map((item) => {
          if (item.kind === "branch") {
            return (
              <ActivityFeedBranch branch={item.branch} key={item.branch.id} onAction={onAction} />
            );
          }

          if (item.kind === "group") {
            return (
              <ActivityFeedGroupedEntry
                compact={isCompact}
                group={{
                  entries: item.group.entries,
                  icon: CircleX,
                  latestEntryAt: item.group.latestEntryAt,
                  title: t("source.close.closedFiles", { count: item.group.count }),
                }}
                key={item.group.id}
              />
            );
          }

          return (
            <ActivityFeedEntry
              compact={isCompact}
              entry={item.entry}
              key={item.entry.id}
              onAction={onAction}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

type ActivityFeedDisplayItem = ActivitySessionItem | { group: ActivityGroup; kind: "group" };

function groupBranchActivityEntriesForDisplay(
  items: readonly ActivitySessionItem[],
): ActivityFeedDisplayItem[] {
  const groupedItems: ActivityFeedDisplayItem[] = [];
  let standaloneEntries: ActivityEntry[] = [];

  function appendStandaloneEntries() {
    groupedItems.push(...groupActivityEntriesForDisplay(standaloneEntries));
    standaloneEntries = [];
  }

  for (const item of items) {
    if (item.kind === "branch") {
      appendStandaloneEntries();
      groupedItems.push(item);
    } else {
      standaloneEntries.push(item.entry);
    }
  }

  appendStandaloneEntries();
  return groupedItems;
}

export { ActivityFeedGroup };
