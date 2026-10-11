import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ExportQueue,
  ExportQueueContent,
  ExportQueueList,
  ExportQueueStartButton,
  ExportQueueStripMetadataCheckbox,
  ExportQueueSummary,
} from "@/features/export/queue";

interface ExportQueueDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function ExportQueueDialog({ onOpenChange, open }: ExportQueueDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <ExportQueue>
        <DialogContent className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg">
          <DialogHeader className="-mx-4 border-b px-4 pb-4">
            <DialogTitle>{t("queue.title")}</DialogTitle>
            <DialogDescription>
              <ExportQueueSummary />
            </DialogDescription>
          </DialogHeader>

          <ExportQueueContent className="-mx-2 px-2" fadeColor="var(--popover)">
            <ExportQueueList className="py-2" />
          </ExportQueueContent>

          <DialogFooter className="sm:items-center sm:justify-between">
            <ExportQueueStripMetadataCheckbox />
            <div className="flex items-center justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">{t("common.actions.close")}</Button>
              </DialogClose>
              <ExportQueueStartButton />
            </div>
          </DialogFooter>
        </DialogContent>
      </ExportQueue>
    </Dialog>
  );
}

export { ExportQueueDialog };
