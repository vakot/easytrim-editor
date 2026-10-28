import { Suspense } from "react";

import { lazyWithPreload } from "@easytrim-editor/ui/lazy-component";

import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  createAlertDialogScope,
} from "@/components/ui/alert-dialog";

const LazyPreviewTransformResetDialogContent = lazyWithPreload<{
  __scopeAlertDialog?: AlertDialogScope;
  onConfirm: () => void;
}>(() =>
  import("./PreviewTransformResetDialogContent").then((module) => ({
    default: module.PreviewTransformResetDialogContent,
  })),
);

const usePreviewTransformResetDialogScope = createAlertDialogScope();

const PreviewTransformResetDialog = Object.assign(
  function PreviewTransformResetDialog({
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
    const alertDialogScope = usePreviewTransformResetDialogScope(__scopeAlertDialog);
    return (
      <AlertDialog {...alertDialogScope} onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent {...alertDialogScope}>
          <Suspense fallback={null}>
            <LazyPreviewTransformResetDialogContent
              __scopeAlertDialog={alertDialogScope.__scopeAlertDialog}
              onConfirm={onConfirm}
            />
          </Suspense>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
  { preload: () => LazyPreviewTransformResetDialogContent.preload() },
);

export { PreviewTransformResetDialog };
