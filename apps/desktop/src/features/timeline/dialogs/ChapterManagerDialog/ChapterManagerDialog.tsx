import React from "react";

import type { DialogScope } from "@/components/ui/dialog";
import { createDialogScope, Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

const LazyChapterManagerDialogContent = lazyWithPreload<{ __scopeDialog?: DialogScope }>(() =>
  import("./ChapterManagerDialogContent").then((module) => ({
    default: module.ChapterManagerDialogContent,
  })),
);

const preloadChapterManagerDialogContent = preloadOnIntent(() =>
  LazyChapterManagerDialogContent.preload(),
);

const useChapterManagerDialogScope = createDialogScope();

function ChapterManagerDialog({
  __scopeDialog,
  children,
}: {
  __scopeDialog?: DialogScope;
  children: React.ReactNode;
}) {
  const dialogScope = useChapterManagerDialogScope(__scopeDialog);
  const source = useAppSelector(selectSourceSelection);

  return (
    <Dialog {...dialogScope}>
      {children}
      <DialogContent {...dialogScope} className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg">
        <React.Suspense fallback={null}>
          <LazyChapterManagerDialogContent
            __scopeDialog={dialogScope.__scopeDialog}
            key={source?.sourcePath ?? "no-source"}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
}

function ChapterManagerDialogTrigger({
  __scopeDialog,
  onFocus,
  onPointerEnter,
  ...props
}: Omit<React.ComponentProps<typeof DialogTrigger>, "disabled">) {
  const dialogScope = useChapterManagerDialogScope(__scopeDialog);
  const source = useAppSelector(selectSourceSelection);

  return (
    <DialogTrigger
      {...dialogScope}
      disabled={!source}
      onFocus={(event) => {
        onFocus?.(event);
        preloadChapterManagerDialogContent();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        preloadChapterManagerDialogContent();
      }}
      {...props}
    />
  );
}

export { ChapterManagerDialog, ChapterManagerDialogTrigger };
