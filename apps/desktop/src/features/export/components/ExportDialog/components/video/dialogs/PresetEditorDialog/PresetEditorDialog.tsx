import { Suspense } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

import { lazyWithPreload } from "@/lib/lazy-component";

import type { PresetEditorDialogContentProps } from "./PresetEditorDialogContent";

const LazyPresetEditorDialogContent = lazyWithPreload<PresetEditorDialogContentProps>(() =>
  import("./PresetEditorDialogContent").then((module) => ({
    default: module.PresetEditorDialogContent,
  })),
);

const PresetEditorDialog = Object.assign(
  function PresetEditorDialog({
    mode,
    onOpenChange,
    open,
    preset,
  }: Omit<PresetEditorDialogContentProps, "onClose"> & {
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-xl">
          <Suspense fallback={null}>
            <LazyPresetEditorDialogContent
              mode={mode}
              onClose={() => onOpenChange(false)}
              preset={preset}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: () => LazyPresetEditorDialogContent.preload() },
);

export { PresetEditorDialog };
