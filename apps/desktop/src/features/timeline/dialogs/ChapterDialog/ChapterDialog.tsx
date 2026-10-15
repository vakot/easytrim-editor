import { type ComponentProps, type ReactNode, Suspense, useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { useChapterDialogScope } from "./hooks/useChapterDialogScope";
import type { ChapterDialogContent } from "./ChapterDialogContent";

const LazyChapterDialogContent = lazyWithPreload<ComponentProps<typeof ChapterDialogContent>>(() =>
  import("./ChapterDialogContent").then((module) => ({
    default: module.ChapterDialogContent,
  })),
);

const preloadChapterDialog = preloadOnIntent(() => LazyChapterDialogContent.preload());

/**
 * Names a chapter. Without `chapterId` it adds a chapter over the selected segment; with one it
 * renames or deletes that chapter. Positions are edited on the timeline.
 */
const ChapterDialog = Object.assign(
  function ChapterDialog({
    chapterId,
    children,
    onOpenChange,
    open: openProp,
  }: {
    chapterId?: string;
    children?: ReactNode;
    onOpenChange?: (open: boolean) => void;
    open?: boolean;
  }) {
    const dialogScope = useChapterDialogScope(undefined);
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const open = openProp ?? uncontrolledOpen;
    const setOpen = (next: boolean) => {
      setUncontrolledOpen(next);
      onOpenChange?.(next);
    };

    return (
      <Dialog {...dialogScope} onOpenChange={setOpen} open={open}>
        {children}

        <DialogContent {...dialogScope}>
          <Suspense fallback={null}>
            <LazyChapterDialogContent chapterId={chapterId} onClose={() => setOpen(false)} />
          </Suspense>
        </DialogContent>
      </Dialog>
    );
  },
  { preload: preloadChapterDialog },
);

function ChapterDialogTrigger({
  onFocus,
  onPointerEnter,
  ...props
}: ComponentProps<typeof DialogTrigger>) {
  const dialogScope = useChapterDialogScope(undefined);

  return (
    <DialogTrigger
      {...dialogScope}
      {...props}
      onFocus={(event) => {
        preloadChapterDialog();
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        preloadChapterDialog();
        onPointerEnter?.(event);
      }}
    />
  );
}

export { ChapterDialog, ChapterDialogTrigger };
