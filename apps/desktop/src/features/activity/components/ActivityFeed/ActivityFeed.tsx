import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@easytrim-editor/ui/class-names";

import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActivityFeedView } from "@/app/store/slices/preferences-slice";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { useRelativeTimeNow } from "@/lib/hooks/use-relative-time";
import { openFileLocation } from "@/lib/tauri/media";

import { useActivityFeed as useActivityFeedSession } from "../../hooks/useActivityFeed";
import {
  type ActivityAction,
  groupActivityEntriesBySession,
  groupActivitySessionsForDisplay,
} from "../../lib/activity-projection";

import { ActivityFeedEmpty } from "./components/ActivityFeedEmpty";
import { ActivityFeedGroup } from "./components/ActivityFeedGroup";

function ActivityFeed({ children }: { children?: React.ReactNode }) {
  const { currentSessionId, entries, sessions } = useActivityFeedSession();

  return (
    <ActivityFeedContext.Provider
      value={{ currentSessionId, entries, sessions, currentAppVersion: getCurrentVersion() }}
    >
      {children}
    </ActivityFeedContext.Provider>
  );
}

function ActivityFeedContent({ className, ...props }: React.ComponentProps<typeof ScrollArea>) {
  const { t } = useTranslation();
  const { currentAppVersion, currentSessionId, entries, sessions } = useActivityFeed();

  const now = useRelativeTimeNow();

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
    <ActivityFeedContentContext.Provider value={{ groups, currentSessionLabel }}>
      <ScrollArea className={cn("min-h-0 flex-1", className)} {...props} />
    </ActivityFeedContentContext.Provider>
  );
}

function ActivityFeedList({ className }: { className?: string }) {
  const { currentAppVersion } = useActivityFeed();
  const { currentSessionLabel, groups } = useActivityFeedContent();

  const activityFeedView = useAppSelector(selectActivityFeedView);
  const isCompact = activityFeedView === "compact";
  const isBranch = activityFeedView === "branch";

  const handleAction = useCallback((action: ActivityAction) => {
    if (action.kind !== "open") return;
    void openFileLocation(action.path).catch(() => undefined);
  }, []);

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
          onAction={handleAction}
          sessionLabels={{ now: currentSessionLabel }}
        />
      ))}
    </div>
  );
}

const ActivityFeedContext = React.createContext<
  | (ReturnType<typeof useActivityFeedSession> & {
      currentAppVersion: ReturnType<typeof getCurrentVersion>;
    })
  | null
>(null);

const ActivityFeedContentContext = React.createContext<{
  currentSessionLabel: string;
  groups: ReturnType<typeof groupActivitySessionsForDisplay>;
} | null>(null);

function useActivityFeed() {
  const context = React.useContext(ActivityFeedContext);
  if (!context) {
    throw new Error("ActivityFeedContent and ActivityFeedList must be used within ActivityFeed");
  }
  return context;
}

function useActivityFeedContent() {
  const context = React.useContext(ActivityFeedContentContext);
  if (!context) {
    throw new Error("ActivityFeedList must be used within ActivityFeedContent");
  }
  return context;
}

export { ActivityFeed, ActivityFeedContent, ActivityFeedList };
