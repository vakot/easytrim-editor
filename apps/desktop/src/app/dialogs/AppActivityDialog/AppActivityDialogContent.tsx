import { useTranslation } from "react-i18next";

import type { DialogScope } from "@/components/ui/dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ActivityFeed, ActivityFeedContent, ActivityFeedList } from "@/features/activity";

function AppActivityDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

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

      <ActivityFeedContent className="-mx-2 px-2" fadeColor="var(--popover)">
        <ActivityFeedList className="py-2" />
      </ActivityFeedContent>
    </ActivityFeed>
  );
}

export { AppActivityDialogContent };
