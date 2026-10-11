import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ActivityFeed } from "@/features/activity";

interface ActivityWorkspaceDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function ActivityWorkspaceDialog({ onOpenChange, open }: ActivityWorkspaceDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="grid h-[min(84dvh,50rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle>{t("layout.activityFeed")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("layout.workspaceViewDescription")}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="-mx-4 min-h-0 px-4">
          <ActivityFeed className="py-4" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export { ActivityWorkspaceDialog };
