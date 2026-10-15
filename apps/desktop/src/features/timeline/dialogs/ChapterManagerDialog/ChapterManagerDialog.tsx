import { type ComponentProps, type ReactNode, Suspense } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { useChapterManagerDialogScope } from "./hooks/useChapterManagerDialogScope";

const LazyChapterManagerDialogContent = lazyWithPreload<Record<string, never>>(() =>
  import("./ChapterManagerDialogContent").then((module) => ({
    default: module.ChapterManagerDialogContent,
  })),
);

const preloadChapterManagerDialog = preloadOnIntent(() =>
  LazyChapterManagerDialogContent.preload(),
);

/** Lists the source's chapters, to add, rename, re-range or delete them. */
function ChapterManagerDialog({ children }: { children: ReactNode }) {
  const dialogScope = useChapterManagerDialogScope(undefined);

  return (
    <Dialog {...dialogScope}>
      {children}

      <DialogContent
        {...dialogScope}
        className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg"
      >
        <Suspense fallback={null}>
          <LazyChapterManagerDialogContent />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

function ChapterManagerDialogTrigger({
  onFocus,
  onPointerEnter,
  ...props
}: Omit<ComponentProps<typeof DialogTrigger>, "disabled">) {
  const dialogScope = useChapterManagerDialogScope(undefined);
  const sourceReady = useAppSelector(selectSourceReady);

  return (
    <DialogTrigger
      {...dialogScope}
      {...props}
      disabled={!sourceReady}
      onFocus={(event) => {
        preloadChapterManagerDialog();
        onFocus?.(event);
      }}
      onPointerEnter={(event) => {
        preloadChapterManagerDialog();
        onPointerEnter?.(event);
      }}
    />
  );
}

export { ChapterManagerDialog, ChapterManagerDialogTrigger };
