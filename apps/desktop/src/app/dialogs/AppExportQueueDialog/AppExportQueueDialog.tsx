import { Suspense } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

const LazyAppExportQueueDialogContent = lazyWithPreload<React.FragmentProps>(() =>
  import("./AppExportQueueDialogContent").then((module) => ({
    default: module.AppExportQueueDialogContent,
  })),
);

const AppExportQueueDialog = Object.assign(
  function AppExportQueueDialog({
    onOpenChange,
    open,
  }: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg">
          <Suspense fallback={null}>
            <LazyAppExportQueueDialogContent />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppExportQueueDialogContent.preload() },
);

export { AppExportQueueDialog };
