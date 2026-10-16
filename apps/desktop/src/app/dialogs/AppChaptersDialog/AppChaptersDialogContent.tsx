import { BookmarkPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { DialogScope } from "@/components/ui/dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  ChapterDialog,
  ChapterDialogTrigger,
  ChaptersContent,
  ChaptersList,
} from "@/features/timeline";

function AppChaptersDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

  return (
    <>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog}>{t("timeline.chapters.title")}</DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("timeline.chapters.description")}
        </DialogDescription>
      </DialogHeader>

      <ChaptersContent className="-mx-2 **:data-[slot=scroll-area-viewport]:px-2">
        <ChaptersList className="py-2" />
      </ChaptersContent>

      <DialogFooter __scopeDialog={__scopeDialog}>
        <ChapterDialog>
          <ChapterDialogTrigger asChild>
            <Button type="button">
              <BookmarkPlus /> {t("timeline.chapters.actions.addChapter")}
            </Button>
          </ChapterDialogTrigger>
        </ChapterDialog>
      </DialogFooter>
    </>
  );
}

export { AppChaptersDialogContent };
