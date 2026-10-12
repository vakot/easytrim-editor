import { Suspense } from "react";

import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

import type { PresetDeleteDialogContentProps } from "./PresetDeleteDialogContent";

const LazyPresetDeleteDialogContent = lazyWithPreload<PresetDeleteDialogContentProps>(() =>
  import("./PresetDeleteDialogContent").then((module) => ({
    default: module.PresetDeleteDialogContent,
  })),
);

const PresetDeleteDialog = Object.assign(
  function PresetDeleteDialog({
    onOpenChange,
    open,
    preset,
  }: Omit<PresetDeleteDialogContentProps, "onConfirm"> & {
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    return (
      <AlertDialog onOpenChange={onOpenChange} open={open}>
        <AlertDialogContent>
          <Suspense fallback={null}>
            <LazyPresetDeleteDialogContent onConfirm={() => onOpenChange(false)} preset={preset} />
          </Suspense>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
  { preload: () => LazyPresetDeleteDialogContent.preload() },
);

export { PresetDeleteDialog };
