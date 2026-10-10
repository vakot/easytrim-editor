import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  exportQueueDialogClosed,
  selectExportQueueDialogOpen,
} from "@/app/store/slices/export-slice";
import {
  preferenceChanged,
  selectStripMetadataOnExport,
} from "@/app/store/slices/preferences-slice";
import { startExportQueue } from "@/app/store/thunks/export-thunks";

import { ExportQueue, ExportQueueContent, ExportQueueSummary } from "../components/ExportQueue";
import { useExportQueue } from "../components/ExportQueue/contexts/ExportQueueContext";

function ExportQueueDialog() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const open = useAppSelector(selectExportQueueDialogOpen);
  const stripMetadataOnExport = useAppSelector(selectStripMetadataOnExport);

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dispatch(exportQueueDialogClosed());
      }}
      open={open}
    >
      <ExportQueue>
        <DialogContent className="max-h-[min(80dvh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg">
          <DialogHeader className="-mx-4 border-b px-4 pb-4">
            <DialogTitle>{t("queue.title")}</DialogTitle>
            <DialogDescription>
              <ExportQueueSummary />
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="-mx-4 min-h-0 px-4" data-testid="export-queue-scroll-area">
            <ExportQueueContent className="py-2" />
          </ScrollArea>

          <DialogFooter className="sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={stripMetadataOnExport}
                id="queue-strip-metadata"
                onCheckedChange={(checked) =>
                  dispatch(
                    preferenceChanged({
                      key: "stripMetadataOnExport",
                      enabled: checked === true,
                    }),
                  )
                }
              />
              <Label
                className="text-sm font-normal text-muted-foreground"
                htmlFor="queue-strip-metadata"
              >
                {t("settings.preferences.stripMetadata.commandLabel")}
              </Label>
            </div>
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

function ExportQueueStartButton() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { summary } = useExportQueue();

  return (
    <Button
      disabled={summary.queued === 0}
      onClick={() => void dispatch(startExportQueue())}
      type="button"
    >
      {t("queue.actions.startQueue")}
    </Button>
  );
}

export { ExportQueueDialog };
