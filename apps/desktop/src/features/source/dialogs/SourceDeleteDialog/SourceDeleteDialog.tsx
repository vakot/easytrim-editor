import { Suspense } from "react";

import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

import type { SourceDeleteDialogContentProps } from "./SourceDeleteDialogContent";

const LazySourceDeleteDialogContent = lazyWithPreload<SourceDeleteDialogContentProps>(() =>
  import("./SourceDeleteDialogContent").then((module) => ({
    default: module.SourceDeleteDialogContent,
  })),
);

const SourceDeleteDialog = Object.assign(
  function SourceDeleteDialog({
    onOpenChange,
    open,
    sourceIds,
    target,
    targetName,
  }: SourceDeleteDialogContentProps & {
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    return (
      <AlertDialog onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent>
          <Suspense fallback={null}>
            <LazySourceDeleteDialogContent
              sourceIds={sourceIds}
              target={target}
              targetName={targetName}
            />
          </Suspense>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
  { preload: () => LazySourceDeleteDialogContent.preload() },
);

export { SourceDeleteDialog };
