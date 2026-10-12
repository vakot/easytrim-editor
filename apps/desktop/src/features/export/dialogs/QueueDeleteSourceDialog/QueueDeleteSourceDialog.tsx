import { Suspense } from "react";

import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  createAlertDialogScope,
} from "@/components/ui/alert-dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

const LazyQueueDeleteSourceDialogContent = lazyWithPreload<{
  __scopeAlertDialog?: AlertDialogScope;
  onConfirm: () => void;
}>(() =>
  import("./QueueDeleteSourceDialogContent").then((module) => ({
    default: module.QueueDeleteSourceDialogContent,
  })),
);

const useQueueDeleteSourceDialogScope = createAlertDialogScope();

const QueueDeleteSourceDialog = Object.assign(
  function QueueDeleteSourceDialog({
    __scopeAlertDialog,
    onConfirm,
    onOpenChange,
    open,
  }: {
    __scopeAlertDialog?: AlertDialogScope;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    const alertDialogScope = useQueueDeleteSourceDialogScope(__scopeAlertDialog);
    return (
      <AlertDialog {...alertDialogScope} onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent {...alertDialogScope}>
          <Suspense fallback={null}>
            <LazyQueueDeleteSourceDialogContent
              __scopeAlertDialog={alertDialogScope.__scopeAlertDialog}
              onConfirm={onConfirm}
            />
          </Suspense>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
  { preload: () => LazyQueueDeleteSourceDialogContent.preload() },
);

export { QueueDeleteSourceDialog };
