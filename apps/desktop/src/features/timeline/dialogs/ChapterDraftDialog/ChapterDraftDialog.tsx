import React, { Suspense, useState } from "react";

import { Dialog, DialogTrigger } from "@/components/ui/dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { EditorChapter } from "@/domain/media";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

import { ChapterDraftContext, useChapterDraft } from "./ChapterDraftDialogContext";

const LazyChapterDraftDialogContent = lazyWithPreload<Record<string, never>>(() =>
  import("./ChapterDraftDialogContent").then((module) => ({
    default: module.ChapterDraftDialogContent,
  })),
);

const preloadChapterDraftDialogContent = preloadOnIntent(() =>
  LazyChapterDraftDialogContent.preload(),
);

function ChapterDraftDialog({
  children,
  defaultOpen,
  onOpenChange,
  open: controlledOpen,
  ...props
}: React.ComponentProps<typeof Dialog>) {
  const [draft, setDraft] = useState<EditorChapter>(() => ({
    endMicros: 0,
    id: crypto.randomUUID(),
    startMicros: 0,
    title: "",
  }));

  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const open = controlledOpen ?? uncontrolledOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <ChapterDraftContext.Provider value={{ draft, setDraft }}>
      <Dialog onOpenChange={handleOpenChange} open={open} {...props}>
        {children}
        {open ? (
          <Suspense fallback={null}>
            <LazyChapterDraftDialogContent />
          </Suspense>
        ) : null}
      </Dialog>
    </ChapterDraftContext.Provider>
  );
}

function ChapterDraftDialogTrigger({
  children,
  disabled,
  draft,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: React.ComponentProps<typeof DialogTrigger> & { draft?: EditorChapter }) {
  const { setDraft } = useChapterDraft();
  const trim = useAppSelector(selectTrim);

  return (
    <DialogTrigger
      disabled={!trim || disabled}
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
    >
      {children}
    </DialogTrigger>
  );
}

export { ChapterDraftDialog, ChapterDraftDialogTrigger };
