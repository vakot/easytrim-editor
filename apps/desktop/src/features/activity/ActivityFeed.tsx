import type { TFunction } from "i18next";
import {
  CircleAlert,
  CircleX,
  ExternalLink,
  FileVideo,
  Film,
  FolderOpen,
  LoaderCircle,
  type LucideIcon,
  RotateCcw,
  Scissors,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Marker,
  MarkerAction,
  MarkerContent,
  MarkerDescription,
  MarkerGroup,
  MarkerIcon,
  MarkerTitle,
} from "@/components/ui/marker";
import { RelativeTimestamp } from "@/components/ui/relative-timestamp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActivityFeedView } from "@/app/store/slices/preferences-slice";
import { formatSourcePath, RestoreSource } from "@/features/source";
import { getCurrentVersion } from "@/lib/app-version.utils";
import { cn } from "@/lib/class-names.utils";
import type { DiagnosticSessionMetadata } from "@/lib/tauri/diagnostics.types";
import { openFileLocation } from "@/lib/tauri/media";

import {
  type ActivityAction,
  type ActivityBranch,
  type ActivityEntry,
  type ActivityKind,
  type ActivitySessionLabels,
  type ActivityStatus,
  getActivitySessionPresentation,
  groupActivityEntriesByBranch,
  groupActivityEntriesBySession,
} from "./activity-projection";
import { useActivityFeed } from "./useActivityFeed";

const activityIcons: Record<ActivityKind, LucideIcon> = {
  "fast-cut": Scissors,
  "file-deleted": Trash2,
  "files-closed": CircleX,
  "file-restored": RotateCcw,
  "files-imported": FileVideo,
  "folders-imported": FolderOpen,
  render: Film,
};

const activityStatusPresentation: Record<ActivityStatus, { className: string; icon?: LucideIcon }> =
  {
    cancelled: { className: "text-muted-foreground", icon: CircleX },
    completed: { className: "text-muted-foreground" },
    failed: { className: "text-destructive", icon: CircleAlert },
    interrupted: { className: "text-destructive", icon: CircleAlert },
    pending: { className: "text-primary", icon: LoaderCircle },
  };

const activityActionPresentation = {
  open: { getLabel: (t: TFunction) => t("app.actions.open"), icon: ExternalLink },
  restore: { getLabel: (t: TFunction) => t("app.actions.restore"), icon: RotateCcw },
} satisfies Record<
  ActivityAction["kind"],
  { getLabel: (t: TFunction) => string; icon: LucideIcon }
>;

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

function ActivityFeedBranch({
  branch,
  onAction,
}: {
  branch: ActivityBranch;
  onAction?: (action: ActivityAction) => void;
}) {
  const { t } = useTranslation();
  const normalizedSourcePath = formatSourcePath(branch.path ?? "");
  const filename =
    normalizedSourcePath.split(/[\\/]/).filter(Boolean).pop() ?? t("app.labels.file");

  return (
    <div>
      <Marker>
        <ActivityEntryMarkerIcon entry={branch.entries[branch.entries.length - 1]} />

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
        {branch.entries.map((entry) => (
          <ActivityFeedMarkerGroupItem entry={entry} key={entry.id} onAction={onAction} />
        ))}
      </MarkerGroup>
    </div>
  );
}

function ActivityFeedMarkerGroupItem({
  entry,
  onAction,
}: {
  entry: ActivityEntry;
  onAction?: (action: ActivityAction) => void;
}) {
  const action = entry.action;

  const showAction = !!action && (action.kind === "restore" || onAction);
  const handleAction = action?.kind === "open" && onAction ? () => onAction(action) : undefined;

  return (
    <Marker className="items-center text-xs">
      <MarkerContent className="flex-row flex-nowrap items-center gap-1">
        <ActivityFeedEntryTitle className="text-muted-foreground" entry={entry} />

        {showAction && <ActivityFeedEntryButton compact entry={entry} onClick={handleAction} />}
      </MarkerContent>
    </Marker>
  );
}

function ActivityFeedEntry({
  compact = false,
  entry,
  onAction,
}: {
  compact?: boolean;
  entry: ActivityEntry;
  onAction?: (action: ActivityAction) => void;
}) {
  const action = entry.action;
  const normalizedSourcePath = formatSourcePath(entry.path ?? "");

  const showAction = !!action && (action.kind === "restore" || onAction);
  const handleAction = action?.kind === "open" && onAction ? () => onAction(action) : undefined;

  if (compact) {
    return (
      <Marker className="h-6 items-center text-xs">
        <ActivityEntryMarkerIcon entry={entry} />

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
      <ActivityEntryMarkerIcon entry={entry} />

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

function ActivityEntryMarkerIcon({ entry }: { entry: ActivityEntry | undefined }) {
  if (!entry) return;

  const statusPresentation = activityStatusPresentation[entry.status];
  const Icon = statusPresentation.icon ?? activityIcons[entry.kind];

  return (
    <MarkerIcon className={statusPresentation.className}>
      <Icon
        aria-hidden="true"
        className={entry.status === "pending" ? "animate-spin" : undefined}
      />
    </MarkerIcon>
  );
}

function ActivityFeedEntryTitle({
  className,
  entry,
}: {
  className?: string;
  entry: ActivityEntry;
}) {
  return (
    <MarkerTitle className={cn("flex min-w-0 flex-nowrap items-center gap-1", className)}>
      <span className={cn("truncate", entry.status === "pending" && "shimmer")}>{entry.title}</span>
      <span>·</span>
      <RelativeTimestamp
        className="shrink-0 text-muted-foreground"
        timestamp={toTimestampMicros(entry.startedAt)}
      />
    </MarkerTitle>
  );
}

function toTimestampMicros(timestamp: string): number | undefined {
  const timestampMs = Date.parse(timestamp);
  return Number.isNaN(timestampMs) ? undefined : timestampMs * 1_000;
}

function ActivityFeedEntryButton({
  compact = false,
  entry,
  onClick,
}: {
  compact?: boolean;
  entry: ActivityEntry;
  onClick?: () => void;
}) {
  const { t } = useTranslation();

  const action = entry.action;
  const actionPresentation = action ? activityActionPresentation[action.kind] : undefined;
  const actionLabel = actionPresentation?.getLabel(t);
  const ActionIcon = actionPresentation?.icon;

  const isValidAction =
    action && actionLabel && ActionIcon && (action.kind === "restore" || onClick);

  if (!isValidAction) return null;

  const button = (
    <Button
      aria-label={actionLabel}
      className={cn(compact && "-mt-1")}
      onClick={action.kind === "open" ? onClick : undefined}
      size="icon-xs"
      variant={compact ? "ghost" : "outline"}
    >
      <ActionIcon aria-hidden="true" />
    </Button>
  );

  const actionButton =
    action.kind === "restore" ? (
      <RestoreSource event="click" itemId={action.targetId} sourcePath={action.path}>
        {button}
      </RestoreSource>
    ) : (
      button
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{actionButton}</TooltipTrigger>
      <TooltipContent>{actionLabel}</TooltipContent>
    </Tooltip>
  );
}
