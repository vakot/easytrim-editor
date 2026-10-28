import React, { Suspense, useState } from "react";

import { lazyWithPreload, preloadOnIntent } from "@easytrim-editor/ui/lazy-component";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import type { PresetEditorRequest } from "./PresetEditorDialogContext";
import { PresetEditorDialogContext, usePresetEditorDialog } from "./PresetEditorDialogContext";

const LazyPresetEditorDialogContent = lazyWithPreload<{ __scopeDialog?: DialogScope }>(() =>
  import("./PresetEditorDialogContent").then((module) => ({
    default: module.PresetEditorDialogContent,
  })),
);

const preloadPresetEditorDialogContent = preloadOnIntent(() =>
  LazyPresetEditorDialogContent.preload(),
);

const usePresetEditorDialogScope = createDialogScope();

function PresetEditorDialog({
  __scopeDialog,
  children,
}: React.PropsWithChildren<{ __scopeDialog?: DialogScope }>) {
  const dialogScope = usePresetEditorDialogScope(__scopeDialog);
  const [request, setRequest] = useState<PresetEditorRequest | null>(null);

  return (
    <PresetEditorDialogContext.Provider value={{ request, setRequest }}>
      <Dialog {...dialogScope} onOpenChange={(open) => !open && setRequest(null)}>
        {children}
        <DialogContent {...dialogScope} className="sm:max-w-xl">
          <Suspense fallback={null}>
            <LazyPresetEditorDialogContent __scopeDialog={dialogScope.__scopeDialog} />
          </Suspense>
        </DialogContent>
      </Dialog>
    </PresetEditorDialogContext.Provider>
  );
}

function PresetEditorDialogTrigger({
  __scopeDialog,
  onClick,
  onFocus,
  onPointerEnter,
  request,
  ...props
}: Omit<React.ComponentProps<typeof DialogTrigger>, "onClick"> & {
  onClick?: React.ComponentProps<typeof DialogTrigger>["onClick"];
  request: PresetEditorRequest;
}) {
  const dialogScope = usePresetEditorDialogScope(__scopeDialog);
  const { setRequest } = usePresetEditorDialog();

  return (
    <DialogTrigger
      {...dialogScope}
      onClick={(event) => {
        setRequest(request);
        onClick?.(event);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preloadPresetEditorDialogContent();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        preloadPresetEditorDialogContent();
      }}
      {...props}
    />
  );
}

export { PresetEditorDialog, PresetEditorDialogTrigger };
