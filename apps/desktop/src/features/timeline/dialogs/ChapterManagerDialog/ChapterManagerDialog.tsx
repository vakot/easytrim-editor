import React from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

const LazyChapterManagerDialogContent = lazyWithPreload<React.FragmentProps>(() =>
  import("./ChapterManagerDialogContent").then((module) => ({
    default: module.ChapterManagerDialogContent,
  })),
);

const preloadChapterManagerDialogContent = preloadOnIntent(() =>
  LazyChapterManagerDialogContent.preload(),
);

function ChapterManagerDialog({ children }: { children: React.ReactNode }) {
  const source = useAppSelector(selectSourceSelection);

  return (
    <Dialog>
      {children}
      <DialogContent className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg">
        <React.Suspense fallback={null}>
          <LazyChapterManagerDialogContent key={source?.sourcePath ?? "no-source"} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
}

function ChapterManagerDialogTrigger({
  onFocus,
  onPointerEnter,
  ...props
}: Omit<React.ComponentProps<typeof DialogTrigger>, "disabled">) {
  const source = useAppSelector(selectSourceSelection);

  return (
    <DialogTrigger
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
