import { Marker, MarkerAction, MarkerContent, MarkerDescription } from "@/components/ui/marker";

import { formatSourcePath } from "@/features/source";

import type { ActivityAction, ActivityEntry } from "../../../lib/activity-projection";

import { ActivityFeedEntryButton } from "./ActivityFeedEntryButton";
import { ActivityFeedEntryIcon } from "./ActivityFeedEntryIcon";
import { ActivityFeedEntryTitle } from "./ActivityFeedEntryTitle";

interface ActivityFeedEntryProps {
  compact?: boolean;
  entry: ActivityEntry;
  onAction?: (action: ActivityAction) => void;
}

export function ActivityFeedEntry({ compact = false, entry, onAction }: ActivityFeedEntryProps) {
  const action = entry.action;
  const normalizedSourcePath = formatSourcePath(entry.path ?? "");
  const showAction = !!action && (action.kind === "restore" || onAction);
  const handleAction = action?.kind === "open" && onAction ? () => onAction(action) : undefined;

  if (compact) {
    return (
      <Marker className="h-6 items-center text-xs">
        <ActivityFeedEntryIcon entry={entry} />

        <MarkerContent className="flex-row flex-nowrap items-center gap-1">
          <ActivityFeedEntryTitle className="text-foreground" entry={entry} />

          {showAction && (
            <ActivityFeedEntryButton compact={compact} entry={entry} onClick={handleAction} />
          )}
        </MarkerContent>
      </Marker>
    );
  }

  return (
    <Marker className="min-h-6 items-start text-xs">
      <ActivityFeedEntryIcon entry={entry} />

      <MarkerContent>
        <ActivityFeedEntryTitle className="text-foreground" entry={entry} />

        <MarkerDescription>
          {entry.path ? (
            <span className="min-w-0 flex-1 truncate" title={normalizedSourcePath}>
              {normalizedSourcePath}
            </span>
          ) : null}
        </MarkerDescription>
      </MarkerContent>

      {showAction && (
        <MarkerAction>
          <ActivityFeedEntryButton compact={compact} entry={entry} onClick={handleAction} />
        </MarkerAction>
      )}
    </Marker>
  );
}
