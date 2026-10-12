import React, { Suspense, useState } from "react";

import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import type { ExportPreset } from "@/app/store/lib/export-presets";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { PresetDeleteDialogContext, usePresetDeleteDialog } from "./PresetDeleteDialogContext";

const LazyPresetDeleteDialogContent = lazyWithPreload<React.FragmentProps>(() =>
  import("./PresetDeleteDialogContent").then((module) => ({
    default: module.PresetDeleteDialogContent,
  })),
);

const preloadPresetDeleteDialogContent = preloadOnIntent(() =>
  LazyPresetDeleteDialogContent.preload(),
);

function PresetDeleteDialog({ children }: React.PropsWithChildren) {
  const [preset, setPreset] = useState<ExportPreset | null>(null);

  return (
    <PresetDeleteDialogContext.Provider value={{ preset, setPreset }}>
      <AlertDialog onOpenChange={(open) => !open && setPreset(null)}>
        {children}
        <AlertDialogContent>
          <Suspense fallback={null}>
            <LazyPresetDeleteDialogContent />
          </Suspense>
        </AlertDialogContent>
      </AlertDialog>
    </PresetDeleteDialogContext.Provider>
  );
}

function PresetDeleteDialogTrigger({
  onClick,
  onFocus,
  onPointerEnter,
  preset,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogTrigger>, "onClick"> & {
  onClick?: React.ComponentProps<typeof AlertDialogTrigger>["onClick"];
  preset: ExportPreset;
}) {
  const { setPreset } = usePresetDeleteDialog();

  return (
    <AlertDialogTrigger
      onClick={(event) => {
        setPreset(preset);
        onClick?.(event);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preloadPresetDeleteDialogContent();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        preloadPresetDeleteDialogContent();
      }}
      {...props}
    />
  );
}

export { PresetDeleteDialog, PresetDeleteDialogTrigger };
