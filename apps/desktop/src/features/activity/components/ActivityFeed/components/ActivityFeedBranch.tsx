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
  const { t } = useTranslation();
  const normalizedSourcePath = formatSourcePath(branch.path ?? "");
  const filename =
    normalizedSourcePath.split(/[\\/]/).filter(Boolean).pop() ?? t("app.labels.file");

  return (
    <div>
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
        {branch.entries.map((entry) => (
          <ActivityFeedMarkerGroupItem entry={entry} key={entry.id} onAction={onAction} />
        ))}
      </MarkerGroup>
    </div>
  );
}

interface ActivityFeedMarkerGroupItemProps {
  entry: ActivityEntry;
  onAction?: (action: ActivityAction) => void;
}

function ActivityFeedMarkerGroupItem({ entry, onAction }: ActivityFeedMarkerGroupItemProps) {
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

export { ActivityFeedBranch };
