import { Suspense } from "react";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

const useAppExportQueueDialogScope = createDialogScope();

const LazyAppExportQueueDialogContent = lazyWithPreload<{
  __scopeDialog?: DialogScope;
}>(() =>
  import("./AppExportQueueDialogContent").then((module) => ({
    default: module.AppExportQueueDialogContent,
  })),
);

const AppExportQueueDialog = Object.assign(
  function AppExportQueueDialog({
    __scopeDialog,
    onOpenChange,
    open,
  }: {
    __scopeDialog?: DialogScope;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    const dialogScope = useAppExportQueueDialogScope(__scopeDialog);
    return (
      <Dialog {...dialogScope} onOpenChange={onOpenChange} open={open}>
        <DialogContent {...dialogScope} className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg">
          <Suspense fallback={null}>
            <LazyAppExportQueueDialogContent __scopeDialog={dialogScope.__scopeDialog} />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppExportQueueDialogContent.preload() },
);

export { AppExportQueueDialog };
