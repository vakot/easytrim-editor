import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActivityFeedView } from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";
import type { DiagnosticSessionMetadata } from "@/lib/tauri/diagnostics.types";

import {
  type ActivityAction,
  type ActivityEntry,
  groupActivityEntriesBySession,
} from "../../../lib/activity-projection";

import { ActivityFeedEmptyState } from "./ActivityFeedEmptyState";
import { ActivityFeedGroup } from "./ActivityFeedGroup";

interface ActivityFeedViewProps {
  currentAppVersion: string;
  currentSessionId: string | null;
  entries: readonly ActivityEntry[];
  now: number;
  onAction?: (action: ActivityAction) => void;
  sessions: readonly DiagnosticSessionMetadata[];
}

function ActivityFeedView({
  currentAppVersion,
  currentSessionId,
  entries,
  now,
  onAction,
  sessions,
}: ActivityFeedViewProps) {
  const { i18n, t } = useTranslation();
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const isCompact = activityFeedView === "compact";
  const isBranch = activityFeedView === "branch";
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const groups = useMemo(
    () => groupActivityEntriesBySession(entries, sessions, currentSessionId),
    [currentSessionId, entries, sessions],
  );

  const sessionLabels = {
    now: t("app.labels.now"),
    today: t("app.labels.today"),
    yesterday: t("app.labels.yesterday"),
  };

  const currentDateTime = new Date(now);

  if (groups.length === 0) return <ActivityFeedEmptyState />;

  return (
    <div className={cn("relative grid", isCompact ? "gap-1" : isBranch ? "gap-5" : "gap-3")}>
      {groups.map((group) => (
        <ActivityFeedGroup
          currentAppVersion={currentAppVersion}
          currentDateTime={currentDateTime}
          group={group}
          isBranch={isBranch}
          isCompact={isCompact}
          key={group.sessionId}
          locale={locale}
          onAction={onAction}
          sessionLabels={sessionLabels}
        />
      ))}
    </div>
  );
}

export { ActivityFeedView };
