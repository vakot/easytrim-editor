import { Suspense } from "react";

import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

const LazyPreviewTransformResetDialogContent = lazyWithPreload<{
  onConfirm: () => void;
}>(() =>
  import("./PreviewTransformResetDialogContent").then((module) => ({
    default: module.PreviewTransformResetDialogContent,
  })),
);

const PreviewTransformResetDialog = Object.assign(
  function PreviewTransformResetDialog({
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
            <LazyPreviewTransformResetDialogContent onConfirm={onConfirm} />
          </Suspense>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
  { preload: () => LazyPreviewTransformResetDialogContent.preload() },
);

export { PreviewTransformResetDialog };
