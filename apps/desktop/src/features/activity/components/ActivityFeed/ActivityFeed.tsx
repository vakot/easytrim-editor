import { useCallback, useEffect, useState } from "react";

import { getCurrentVersion } from "@/lib/app-version.utils";
import { openFileLocation } from "@/lib/tauri/media";

import { useActivityFeed } from "../../hooks/useActivityFeed";
import type { ActivityAction } from "../../lib/activity-projection";

import { ActivityFeedView } from "./components/ActivityFeedView";

export function ActivityFeed() {
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const { currentSessionId, entries, sessions } = useActivityFeed();

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleAction = useCallback((action: ActivityAction) => {
    if (action.kind !== "open") return;
    void openFileLocation(action.path).catch(() => undefined);
  }, []);

  return (
    <ActivityFeedView
      currentAppVersion={getCurrentVersion()}
      currentSessionId={currentSessionId}
      entries={entries}
      now={currentTime}
      onAction={handleAction}
      sessions={sessions}
    />
  );
}

export { ActivityFeedView };
