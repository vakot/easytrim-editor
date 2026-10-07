import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActivityFeedView } from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";
import { useRelativeTimeNow } from "@/lib/hooks/use-relative-time";
import type { DiagnosticSessionMetadata } from "@/lib/tauri/diagnostics.types";

import {
  type ActivityAction,
  type ActivityEntry,
  groupActivityEntriesBySession,
  groupActivitySessionsForDisplay,
} from "../../../lib/activity-projection";

import { ActivityFeedEmpty } from "./ActivityFeedEmpty";
import { ActivityFeedGroup } from "./ActivityFeedGroup";

interface ActivityFeedViewProps {
  className?: string;
  currentAppVersion: string;
  currentSessionId: string | null;
  entries: readonly ActivityEntry[];
  onAction?: (action: ActivityAction) => void;
  sessions: readonly DiagnosticSessionMetadata[];
}

function ActivityFeedView({
  className,
  currentAppVersion,
  currentSessionId,
  entries,
  onAction,
  sessions,
}: ActivityFeedViewProps) {
  const { t } = useTranslation();
  const now = useRelativeTimeNow();
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const isCompact = activityFeedView === "compact";
  const isBranch = activityFeedView === "branch";
  const sessionGroups = useMemo(
    () => groupActivityEntriesBySession(entries, sessions, currentSessionId),
    [currentSessionId, entries, sessions],
  );

  const currentSessionLabel = t("activity.time.now");
  const groups = useMemo(
    () =>
      groupActivitySessionsForDisplay(sessionGroups, currentAppVersion, currentSessionLabel, now),
    [currentAppVersion, currentSessionLabel, now, sessionGroups],
  );

  if (groups.length === 0) return <ActivityFeedEmpty />;

  return (
    <div
      className={cn("relative grid", isCompact ? "gap-1" : isBranch ? "gap-5" : "gap-3", className)}
    >
      {groups.map((group) => (
        <ActivityFeedGroup
          currentAppVersion={currentAppVersion}
          group={group}
          isBranch={isBranch}
          isCompact={isCompact}
          key={JSON.stringify(group.sessionIds)}
          onAction={onAction}
          sessionLabels={{ now: currentSessionLabel }}
        />
      ))}
    </div>
  );
}

export { ActivityFeedView };
