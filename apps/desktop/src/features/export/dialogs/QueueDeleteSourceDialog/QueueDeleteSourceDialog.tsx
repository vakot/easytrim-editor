import { Suspense } from "react";

import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

const LazyQueueDeleteSourceDialogContent = lazyWithPreload<{
  onConfirm: () => void;
}>(() =>
  import("./QueueDeleteSourceDialogContent").then((module) => ({
    default: module.QueueDeleteSourceDialogContent,
  })),
);

const QueueDeleteSourceDialog = Object.assign(
  function QueueDeleteSourceDialog({
    onConfirm,
    onOpenChange,
    open,
  }: {
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    return (
      <AlertDialog onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent>
          <Suspense fallback={null}>
            <LazyQueueDeleteSourceDialogContent onConfirm={onConfirm} />
          </Suspense>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
  { preload: () => LazyQueueDeleteSourceDialogContent.preload() },
);

export { QueueDeleteSourceDialog };
