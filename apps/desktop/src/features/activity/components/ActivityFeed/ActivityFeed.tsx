import { useCallback } from "react";

import { getCurrentVersion } from "@/lib/app-version.utils";
import { openFileLocation } from "@/lib/tauri/media";

import { useActivityFeed } from "../../hooks/useActivityFeed";
import type { ActivityAction } from "../../lib/activity-projection";

import { ActivityFeedView } from "./components/ActivityFeedView";

function ActivityFeed({ className }: { className?: string }) {
  const { currentSessionId, entries, sessions } = useActivityFeed();

  const handleAction = useCallback((action: ActivityAction) => {
    if (action.kind !== "open") return;
    void openFileLocation(action.path).catch(() => undefined);
  }, []);

  return (
    <ActivityFeedView
      className={className}
      currentAppVersion={getCurrentVersion()}
      currentSessionId={currentSessionId}
      entries={entries}
      onAction={handleAction}
      sessions={sessions}
    />
  );
}

export { ActivityFeed, ActivityFeedView };
