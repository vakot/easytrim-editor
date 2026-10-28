import { Suspense } from "react";

import { lazyWithPreload } from "@easytrim-editor/ui/lazy-component";

import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  createAlertDialogScope,
} from "@/components/ui/alert-dialog";

import type { SourceDeleteDialogContentProps } from "./SourceDeleteDialogContent";

const LazySourceDeleteDialogContent = lazyWithPreload<SourceDeleteDialogContentProps>(() =>
  import("./SourceDeleteDialogContent").then((module) => ({
    default: module.SourceDeleteDialogContent,
  })),
);

const useSourceDeleteDialogScope = createAlertDialogScope();

const SourceDeleteDialog = Object.assign(
  function SourceDeleteDialog({
    __scopeAlertDialog,
    onOpenChange,
    open,
    sourceIds,
    target,
    targetName,
  }: SourceDeleteDialogContentProps & {
    __scopeAlertDialog?: AlertDialogScope;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    const alertDialogScope = useSourceDeleteDialogScope(__scopeAlertDialog);
    return (
      <AlertDialog {...alertDialogScope} onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent {...alertDialogScope}>
          <Suspense fallback={null}>
            <LazySourceDeleteDialogContent
              __scopeAlertDialog={alertDialogScope.__scopeAlertDialog}
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
