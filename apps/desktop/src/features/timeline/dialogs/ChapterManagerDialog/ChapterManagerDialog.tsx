import { BookmarkPlus } from "lucide-react";
import React, { Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";

const LazyChapterManagerDialogContent = lazyWithPreload<{ sourceKey: string }>(() =>
  import("./ChapterManagerDialogContent").then((module) => ({
    default: module.ChapterManagerDialogContent,
  })),
);

const preloadChapterManagerDialogContent = preloadOnIntent(() =>
  LazyChapterManagerDialogContent.preload(),
);

function ChapterManagerDialog({ children }: { children: React.ReactNode }) {
  const source = useAppSelector(selectSourceSelection);
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {children}
      {open ? (
        <Suspense fallback={null}>
          <LazyChapterManagerDialogContent sourceKey={source?.sourcePath ?? "no-source"} />
        </Suspense>
      ) : null}
    </Dialog>
  );
}

function ChapterManagerDialogTrigger({
  disabled,
  onFocus,
  onPointerEnter,
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const { t } = useTranslation();
  const trim = useAppSelector(selectTrim);

  return (
    <DialogTrigger
      disabled={!trim || disabled}
      onFocus={(event) => {
        onFocus?.(event);
        preloadChapterManagerDialogContent();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        preloadChapterManagerDialogContent();
      }}
      {...props}
      asChild
    >
      <Button
        aria-label={t("timeline.chapters.actions.manageChapters")}
        disabled={!trim || disabled}
        size="icon-sm"
        type="button"
        variant="secondary"
      >
        <BookmarkPlus />
      </Button>
    </DialogTrigger>
  );
}

export { ChapterManagerDialog, ChapterManagerDialogTrigger };
