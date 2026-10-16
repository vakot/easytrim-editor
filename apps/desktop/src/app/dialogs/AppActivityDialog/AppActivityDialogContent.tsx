import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { DialogScope } from "@/components/ui/dialog";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useApplicationCommands } from "@/app/hooks/useApplicationCommands";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActivityFeedView } from "@/app/store/slices/preferences-slice";
import { ActivityFeed, ActivityFeedContent, ActivityFeedList } from "@/features/activity";

function AppActivityDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();
  const { executeCommand } = useApplicationCommands();
  const activityFeedView = useAppSelector(selectActivityFeedView);
  const activityFeedViewLabels = {
    default: t("settings.layout.activityFeedView.options.default"),
    compact: t("settings.layout.activityFeedView.options.compact"),
    branch: t("settings.layout.activityFeedView.options.branch"),
  };

  return (
    <ActivityFeed>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog} autoFocus tabIndex={-1}>
          {t("activity.title")}
        </DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("activity.description")}
        </DialogDescription>
      </DialogHeader>

      <ActivityFeedContent className="-mx-2 px-2">
        <ActivityFeedList className="py-2" />
      </ActivityFeedContent>

      <DialogFooter __scopeDialog={__scopeDialog} className="sm:justify-between">
        <Select
          onValueChange={(value) =>
            void executeCommand(
              `activity-feed-view-${value}` as `activity-feed-view-${typeof activityFeedView}`,
              "dialog",
            )
          }
          value={activityFeedView}
        >
          <SelectTrigger aria-label={t("settings.layout.activityFeedView.label")} variant="primary">
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {(["default", "compact", "branch"] as const).map((view) => (
              <SelectItem key={view} value={view}>
                {activityFeedViewLabels[view]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogClose __scopeDialog={__scopeDialog} asChild>
          <Button variant="outline">{t("common.actions.close")}</Button>
        </DialogClose>
      </DialogFooter>
    </ActivityFeed>
  );
}

export { AppActivityDialogContent };
