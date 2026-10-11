import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ActivityFeed, ActivityFeedContent, ActivityFeedList } from "@/features/activity";

interface ActivityWorkspaceDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function ActivityWorkspaceDialog({ onOpenChange, open }: ActivityWorkspaceDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <ActivityFeed>
        <DialogContent className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden pb-0 sm:max-w-lg">
          <DialogHeader className="-mx-4 border-b px-4 pb-4">
            <DialogTitle>{t("activity.title")}</DialogTitle>
            <DialogDescription>{t("activity.description")}</DialogDescription>
          </DialogHeader>

          <ActivityFeedContent className="-mx-2 px-2" fadeColor="var(--popover)">
            <ActivityFeedList className="py-2" />
          </ActivityFeedContent>
        </DialogContent>
      </ActivityFeed>
    </Dialog>
  );
}

export { ActivityWorkspaceDialog };
