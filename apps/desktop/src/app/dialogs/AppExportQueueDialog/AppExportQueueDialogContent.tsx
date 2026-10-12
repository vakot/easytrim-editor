import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
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

function AppExportQueueDialogContent() {
  const { t } = useTranslation();

  return (
    <ExportQueue>
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
    </ExportQueue>
  );
}

export { AppExportQueueDialogContent };
