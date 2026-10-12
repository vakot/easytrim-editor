import { Suspense } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

const LazyAppSourcesDialogContent = lazyWithPreload<React.FragmentProps>(() =>
  import("./AppSourcesDialogContent").then((module) => ({
    default: module.AppSourcesDialogContent,
  })),
);

const AppSourcesDialog = Object.assign(
  function AppSourcesDialog({
    onOpenChange,
    open,
  }: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden pb-0 sm:max-w-lg">
          <Suspense fallback={null}>
            <LazyAppSourcesDialogContent />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyAppSourcesDialogContent.preload() },
);

export { AppSourcesDialog };
