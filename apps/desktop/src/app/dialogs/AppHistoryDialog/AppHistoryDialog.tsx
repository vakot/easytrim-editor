import { Suspense } from "react";

import { lazyWithPreload } from "@easytrim-editor/ui/lazy-component";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

const useAppHistoryDialogScope = createDialogScope();

const LazyAppHistoryDialogContent = lazyWithPreload<{
  __scopeDialog?: DialogScope;
}>(() =>
  import("./AppHistoryDialogContent").then((module) => ({
    default: module.AppHistoryDialogContent,
  })),
);

const AppHistoryDialog = Object.assign(
  function AppHistoryDialog({
    __scopeDialog,
    onOpenChange,
    open,
  }: {
    __scopeDialog?: DialogScope;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    const dialogScope = useAppHistoryDialogScope(__scopeDialog);
    return (
      <Dialog {...dialogScope} onOpenChange={onOpenChange} open={open}>
        <DialogContent
          {...dialogScope}
          className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg"
        >
          <Suspense fallback={null}>
            <LazyAppHistoryDialogContent __scopeDialog={dialogScope.__scopeDialog} />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppHistoryDialogContent.preload() },
);

export { AppHistoryDialog };
