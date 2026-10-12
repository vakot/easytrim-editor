import React, { Suspense, useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import type { PresetEditorRequest } from "./PresetEditorDialogContext";
import { PresetEditorDialogContext, usePresetEditorDialog } from "./PresetEditorDialogContext";

const LazyPresetEditorDialogContent = lazyWithPreload<React.FragmentProps>(() =>
  import("./PresetEditorDialogContent").then((module) => ({
    default: module.PresetEditorDialogContent,
  })),
);

const preloadPresetEditorDialogContent = preloadOnIntent(() =>
  LazyPresetEditorDialogContent.preload(),
);

function PresetEditorDialog({ children }: React.PropsWithChildren) {
  const [request, setRequest] = useState<PresetEditorRequest | null>(null);

  return (
    <PresetEditorDialogContext.Provider value={{ request, setRequest }}>
      <Dialog onOpenChange={(open) => !open && setRequest(null)}>
        {children}
        <DialogContent className="sm:max-w-xl">
          <Suspense fallback={null}>
            <LazyPresetEditorDialogContent />
          </Suspense>
        </DialogContent>
      </Dialog>
    </PresetEditorDialogContext.Provider>
  );
}

function PresetEditorDialogTrigger({
  onClick,
  onFocus,
  onPointerEnter,
  request,
  ...props
}: Omit<React.ComponentProps<typeof DialogTrigger>, "onClick"> & {
  onClick?: React.ComponentProps<typeof DialogTrigger>["onClick"];
  request: PresetEditorRequest;
}) {
  const { setRequest } = usePresetEditorDialog();

  return (
    <DialogTrigger
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
