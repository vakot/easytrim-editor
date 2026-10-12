import React, { Suspense, useState } from "react";

import type { AlertDialogScope } from "@/components/ui/alert-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTrigger,
  createAlertDialogScope,
} from "@/components/ui/alert-dialog";

import type { ExportPreset } from "@/app/store/lib/export-presets";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { PresetDeleteDialogContext, usePresetDeleteDialog } from "./PresetDeleteDialogContext";

const LazyPresetDeleteDialogContent = lazyWithPreload<{
  __scopeAlertDialog?: AlertDialogScope;
}>(() =>
  import("./PresetDeleteDialogContent").then((module) => ({
    default: module.PresetDeleteDialogContent,
  })),
);

const preloadPresetDeleteDialogContent = preloadOnIntent(() =>
  LazyPresetDeleteDialogContent.preload(),
);

const usePresetDeleteDialogScope = createAlertDialogScope();

function PresetDeleteDialog({
  __scopeAlertDialog,
  children,
}: React.PropsWithChildren<{ __scopeAlertDialog?: AlertDialogScope }>) {
  const alertDialogScope = usePresetDeleteDialogScope(__scopeAlertDialog);
  const [preset, setPreset] = useState<ExportPreset | null>(null);

  return (
    <PresetDeleteDialogContext.Provider value={{ preset, setPreset }}>
      <AlertDialog {...alertDialogScope} onOpenChange={(open) => !open && setPreset(null)}>
        {children}
        <AlertDialogContent {...alertDialogScope}>
          <Suspense fallback={null}>
            <LazyPresetDeleteDialogContent
              __scopeAlertDialog={alertDialogScope.__scopeAlertDialog}
            />
          </Suspense>
        </AlertDialogContent>
      </AlertDialog>
    </PresetDeleteDialogContext.Provider>
  );
}

function PresetDeleteDialogTrigger({
  __scopeAlertDialog,
  onClick,
  onFocus,
  onPointerEnter,
  preset,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialogTrigger>, "onClick"> & {
  onClick?: React.ComponentProps<typeof AlertDialogTrigger>["onClick"];
  preset: ExportPreset;
}) {
  const alertDialogScope = usePresetDeleteDialogScope(__scopeAlertDialog);
  const { setPreset } = usePresetDeleteDialog();

  return (
    <AlertDialogTrigger
      {...alertDialogScope}
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
