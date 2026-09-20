import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Marker, MarkerContent } from "@/components/ui/marker";
import { RelativeTimestamp } from "@/components/ui/relative-timestamp";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActivityFeedView } from "@/app/store/slices/preferences-slice";
import { cn } from "@/lib/class-names.utils";
import type { DiagnosticSessionMetadata } from "@/lib/tauri/diagnostics.types";

import {
  type ActivityAction,
  type ActivityEntry,
  type ActivitySessionLabels,
  getActivitySessionPresentation,
  groupActivityEntriesByBranch,
  groupActivityEntriesBySession,
} from "../../../lib/activity-projection";

import { ActivityFeedBranch } from "./ActivityFeedBranch";
import { ActivityFeedEntry } from "./ActivityFeedEntry";

interface ActivityFeedViewProps {
  currentAppVersion: string;
  currentSessionId: string | null;
  entries: readonly ActivityEntry[];
  now: number;
  onAction?: (action: ActivityAction) => void;
  sessions: readonly DiagnosticSessionMetadata[];
}

const sessionSeparatorClassNames = {
  current: "font-semibold text-destructive before:bg-destructive after:bg-destructive",
  default: undefined,
  warning: "font-medium text-warning before:bg-warning after:bg-warning",
} satisfies Record<"current" | "default" | "warning", string | undefined>;

export function ActivityFeedView({
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

  const currentDateTime = new Date(now);
  const sessionLabels: ActivitySessionLabels = {
    now: t("app.labels.now"),
    today: t("app.labels.today"),
    yesterday: t("app.labels.yesterday"),
  };

  return (
    <>
      {groups.length === 0 ? (
        <p className="mx-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {t("app.messages.activityEmpty")}
        </p>
      ) : (
        <div className={cn("relative grid", isCompact ? "gap-1" : isBranch ? "gap-5" : "gap-3")}>
          {groups.map((group) => {
            const presentation = getActivitySessionPresentation(
              group,
              currentAppVersion,
              currentDateTime,
              locale,
              sessionLabels,
            );

            return (
              <div
                className={cn("flex flex-col", isCompact ? "gap-1" : isBranch ? "gap-5" : "gap-3")}
                key={group.sessionId}
              >
                <div className="sticky top-0 z-10 bg-card">
                  <Marker
                    className={sessionSeparatorClassNames[presentation.tone]}
                    variant="separator"
                  >
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

                {isBranch
                  ? groupActivityEntriesByBranch(group.entries).map((item) =>
                      item.kind === "branch" ? (
                        <ActivityFeedBranch
                          branch={item.branch}
                          key={item.branch.id}
                          onAction={onAction}
                        />
                      ) : (
                        <ActivityFeedEntry
                          entry={item.entry}
                          key={item.entry.id}
                          onAction={onAction}
                        />
                      ),
                    )
                  : group.entries.map((entry) => (
                      <ActivityFeedEntry
                        compact={isCompact}
                        entry={entry}
                        key={entry.id}
                        onAction={onAction}
                      />
                    ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function toTimestampMicros(timestamp: string): number | undefined {
  const timestampMs = Date.parse(timestamp);
  return Number.isNaN(timestampMs) ? undefined : timestampMs * 1_000;
}
