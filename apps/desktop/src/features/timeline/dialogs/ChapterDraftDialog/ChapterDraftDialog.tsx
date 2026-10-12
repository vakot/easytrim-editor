import React, { useState } from "react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { EditorChapter } from "@/domain/media";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { ChapterDraftContext, useChapterDraft } from "./ChapterDraftDialogContext";

const LazyChapterDraftDialogContent = lazyWithPreload<React.FragmentProps>(() =>
  import("./ChapterDraftDialogContent").then((module) => ({
    default: module.ChapterDraftDialogContent,
  })),
);

const preloadChapterDraftDialogContent = preloadOnIntent(() =>
  LazyChapterDraftDialogContent.preload(),
);

function ChapterDraftDialog({ children, ...props }: React.ComponentProps<typeof Dialog>) {
  const [draft, setDraft] = useState<EditorChapter>(() => ({
    endMicros: 0,
    id: crypto.randomUUID(),
    startMicros: 0,
    title: "",
  }));

  return (
    <ChapterDraftContext.Provider value={{ draft, setDraft }}>
      <Dialog {...props}>
        {children}
        <DialogContent className="sm:max-w-lg">
          <React.Suspense fallback={null}>
            <LazyChapterDraftDialogContent />
          </React.Suspense>
        </DialogContent>
      </Dialog>
    </ChapterDraftContext.Provider>
  );
}

function ChapterDraftDialogTrigger({
  draft,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: Omit<React.ComponentProps<typeof DialogTrigger>, "disabled"> & { draft?: EditorChapter }) {
  const { setDraft } = useChapterDraft();
  const trim = useAppSelector(selectTrim);

  return (
    <DialogTrigger
      disabled={!trim && !draft}
      onClick={(event) => {
        setDraft(
          draft ?? {
            endMicros: trim?.endMicros ?? 0,
            id: crypto.randomUUID(),
            startMicros: trim?.startMicros ?? 0,
            title: "",
          },
        );
        onClick?.(event);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preloadChapterDraftDialogContent();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        preloadChapterDraftDialogContent();
      }}
      {...props}
    />
  );
}

export { ChapterDraftDialog, ChapterDraftDialogTrigger };
