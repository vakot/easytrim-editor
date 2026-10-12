import { Suspense } from "react";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent } from "@/components/ui/dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

const useAppSourcesDialogScope = createDialogScope();

const LazyAppSourcesDialogContent = lazyWithPreload<{
  __scopeDialog?: DialogScope;
}>(() =>
  import("./AppSourcesDialogContent").then((module) => ({
    default: module.AppSourcesDialogContent,
  })),
);

const AppSourcesDialog = Object.assign(
  function AppSourcesDialog({
    __scopeDialog,
    onOpenChange,
    open,
  }: {
    __scopeDialog?: DialogScope;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    const dialogScope = useAppSourcesDialogScope(__scopeDialog);
    return (
      <Dialog {...dialogScope} onOpenChange={onOpenChange} open={open}>
        <DialogContent {...dialogScope} className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden pb-0 sm:max-w-lg">
          <Suspense fallback={null}>
            <LazyAppSourcesDialogContent __scopeDialog={dialogScope.__scopeDialog} />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppSourcesDialogContent.preload() },
);

export { AppSourcesDialog };
