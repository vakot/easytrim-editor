import type { TFunction } from "i18next";
import { ExternalLink, type LucideIcon, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { RestoreSource } from "@/features/source";
import { cn } from "@/lib/class-names.utils";

import type { ActivityAction, ActivityEntry } from "../../../lib/activity-projection";

const activityActionPresentation = {
  open: { getLabel: (t: TFunction) => t("app.actions.open"), icon: ExternalLink },
  restore: { getLabel: (t: TFunction) => t("app.actions.restore"), icon: RotateCcw },
} satisfies Record<
  ActivityAction["kind"],
  { getLabel: (t: TFunction) => string; icon: LucideIcon }
>;

interface ActivityFeedEntryButtonProps {
  compact?: boolean;
  entry: ActivityEntry;
  onClick?: () => void;
}

export function ActivityFeedEntryButton({
  compact = false,
  entry,
  onClick,
}: ActivityFeedEntryButtonProps) {
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
