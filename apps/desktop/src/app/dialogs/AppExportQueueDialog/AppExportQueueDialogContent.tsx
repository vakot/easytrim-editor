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
  ExportQueue,
  ExportQueueContent,
  ExportQueueList,
  ExportQueueStartButton,
  ExportQueueStripMetadataCheckbox,
  ExportQueueSummary,
} from "@/features/export/queue";

function AppExportQueueDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

  return (
    <ExportQueue>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog} autoFocus tabIndex={-1}>
          {t("queue.title")}
        </DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          <ExportQueueSummary />
        </DialogDescription>
      </DialogHeader>

      <ExportQueueContent className="-mx-2 **:data-[slot=scroll-area-viewport]:px-2">
        <ExportQueueList className="py-2" />
      </ExportQueueContent>

      <DialogFooter __scopeDialog={__scopeDialog} className="sm:items-center sm:justify-between">
        <ExportQueueStripMetadataCheckbox />
        <div className="flex items-center justify-end gap-2">
          <DialogClose __scopeDialog={__scopeDialog} asChild>
            <Button variant="outline">{t("common.actions.close")}</Button>
          </DialogClose>
          <ExportQueueStartButton />
        </div>
      </DialogFooter>
    </ExportQueue>
  );
}

export { AppExportQueueDialogContent };
