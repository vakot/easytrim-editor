import { motion, useReducedMotion } from "motion/react";

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

function ActivityFeedEntry({ compact = false, entry, onAction }: ActivityFeedEntryProps) {
  const shouldReduceMotion = useReducedMotion() === true;
  const motionProps = {
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : -4 },
    initial: shouldReduceMotion ? false : { opacity: 0, y: 4 },
    layout: shouldReduceMotion ? false : ("position" as const),
    transition: { duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" as const },
  };

  const action = entry.action;
  const normalizedSourcePath = formatSourcePath(entry.path ?? "");
  const showAction = !!action && (action.kind === "restore" || onAction);
  const handleAction = action?.kind === "open" && onAction ? () => onAction(action) : undefined;

  if (compact) {
    return (
      <Marker asChild className="h-6 items-center text-xs">
        <motion.div {...motionProps}>
          <ActivityFeedEntryIcon entry={entry} />

          <MarkerContent className="flex-row flex-nowrap items-center gap-1">
            <ActivityFeedEntryTitle className="text-foreground" entry={entry} />

            {showAction && (
              <ActivityFeedEntryButton compact={compact} entry={entry} onClick={handleAction} />
            )}
          </MarkerContent>
        </motion.div>
      </Marker>
    );
  }

  return (
    <Marker asChild className="min-h-6 items-start text-xs">
      <motion.div {...motionProps}>
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
      </motion.div>
    </Marker>
  );
}

export { ActivityFeedEntry };
