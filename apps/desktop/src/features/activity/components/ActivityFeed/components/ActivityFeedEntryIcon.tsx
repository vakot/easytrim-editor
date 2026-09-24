import {
  CircleAlert,
  CircleX,
  FileVideo,
  Film,
  FolderOpen,
  LoaderCircle,
  type LucideIcon,
  RotateCcw,
  Scissors,
  Trash2,
} from "lucide-react";

import { MarkerIcon } from "@/components/ui/marker";

import type { ActivityEntry, ActivityKind, ActivityStatus } from "../../../lib/activity-projection";

const activityIcons: Record<ActivityKind, LucideIcon> = {
  "fast-cut": Scissors,
  "file-deleted": Trash2,
  "files-closed": CircleX,
  "file-restored": RotateCcw,
  "files-imported": FileVideo,
  "folders-imported": FolderOpen,
  render: Film,
  "workspace-restored": RotateCcw,
};

const activityStatusPresentation: Record<ActivityStatus, { className: string; icon?: LucideIcon }> =
  {
    cancelled: { className: "text-muted-foreground", icon: CircleX },
    completed: { className: "text-muted-foreground" },
    failed: { className: "text-destructive", icon: CircleAlert },
    interrupted: { className: "text-destructive", icon: CircleAlert },
    pending: { className: "text-primary", icon: LoaderCircle },
  };

interface ActivityFeedEntryIconProps {
  entry: ActivityEntry | undefined;
}

function ActivityFeedEntryIcon({ entry }: ActivityFeedEntryIconProps) {
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

export { ActivityFeedEntryIcon };
