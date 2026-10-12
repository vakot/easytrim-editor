import { BookmarkPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { DialogScope } from "@/components/ui/dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ChapterDraftDialog, ChapterDraftDialogTrigger } from "../ChapterDraftDialog";

import { Chapters, ChaptersContent, ChaptersList } from "./components/Chapters";

function ChapterManagerDialogContent({ __scopeDialog }: { __scopeDialog?: DialogScope }) {
  const { t } = useTranslation();

  return (
    <>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle __scopeDialog={__scopeDialog}>{t("timeline.chapters.title")}</DialogTitle>
        <DialogDescription __scopeDialog={__scopeDialog}>
          {t("timeline.chapters.description")}
        </DialogDescription>
      </DialogHeader>

      <Chapters>
        <ChaptersContent className="-mx-2 px-2">
          <ChaptersList className="py-2" />
        </ChaptersContent>
      </Chapters>

      <DialogFooter __scopeDialog={__scopeDialog}>
        <ChapterDraftDialog>
          <ChapterDraftDialogTrigger asChild>
            <Button type="button">
              <BookmarkPlus /> {t("timeline.chapters.actions.addChapter")}
            </Button>
          </ChapterDraftDialogTrigger>
        </ChapterDraftDialog>
      </DialogFooter>
    </>
  );
}

export { ChapterManagerDialogContent };
