import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import {
  Marker,
  MarkerContent,
  MarkerDescription,
  MarkerGroup,
  MarkerTitle,
} from "@/components/ui/marker";

import { formatSourcePath } from "@/features/source";

import type {
  ActivityAction,
  ActivityBranch,
  ActivityEntry,
} from "../../../lib/activity-projection";

import { ActivityFeedEntryButton } from "./ActivityFeedEntryButton";
import { ActivityFeedEntryIcon } from "./ActivityFeedEntryIcon";
import { ActivityFeedEntryTitle } from "./ActivityFeedEntryTitle";

interface ActivityFeedBranchProps {
  branch: ActivityBranch;
  onAction?: (action: ActivityAction) => void;
}

function ActivityFeedBranch({ branch, onAction }: ActivityFeedBranchProps) {
  const shouldReduceMotion = useReducedMotion() === true;
  const { t } = useTranslation();
  const normalizedSourcePath = formatSourcePath(branch.path ?? "");
  const filename =
    normalizedSourcePath.split(/[\\/]/).filter(Boolean).pop() ?? t("app.labels.file");

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
      layout={shouldReduceMotion ? false : "position"}
      transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" }}
    >
      <Marker>
        <ActivityFeedEntryIcon entry={branch.entries[branch.entries.length - 1]} />

        <MarkerContent>
          <MarkerTitle className="min-w-0 truncate text-xs text-foreground">{filename}</MarkerTitle>
          <MarkerDescription className="truncate">
            {branch.path ? (
              <span className="min-w-0 flex-1 truncate" title={normalizedSourcePath}>
                {normalizedSourcePath}
              </span>
            ) : null}
          </MarkerDescription>
        </MarkerContent>
      </Marker>

      <MarkerGroup className="gap-2 pt-2">
        <AnimatePresence initial={false}>
          {branch.entries.map((entry) => (
            <ActivityFeedMarkerGroupItem entry={entry} key={entry.id} onAction={onAction} />
          ))}
        </AnimatePresence>
      </MarkerGroup>
    </motion.div>
  );
}

interface ActivityFeedMarkerGroupItemProps {
  entry: ActivityEntry;
  onAction?: (action: ActivityAction) => void;
}

function ActivityFeedMarkerGroupItem({ entry, onAction }: ActivityFeedMarkerGroupItemProps) {
  const shouldReduceMotion = useReducedMotion() === true;
  const action = entry.action;
  const showAction = !!action && (action.kind === "restore" || onAction);
  const handleAction = action?.kind === "open" && onAction ? () => onAction(action) : undefined;

  return (
    <Marker asChild className="items-center text-xs">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -4 }}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
        layout={shouldReduceMotion ? false : "position"}
        transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: "easeOut" }}
      >
        <MarkerContent className="flex-row flex-nowrap items-center gap-1">
          <ActivityFeedEntryTitle className="text-muted-foreground" entry={entry} />

          {showAction && <ActivityFeedEntryButton compact entry={entry} onClick={handleAction} />}
        </MarkerContent>
      </motion.div>
    </Marker>
  );
}

export { ActivityFeedBranch };
