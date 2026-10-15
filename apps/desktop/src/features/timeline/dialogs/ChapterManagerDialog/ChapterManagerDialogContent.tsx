import { BookmarkPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ChapterDialog, ChapterDialogTrigger } from "../ChapterDialog";

import { ChaptersContent, ChaptersList } from "./components/Chapters";
import { useChapterManagerDialogScope } from "./hooks/useChapterManagerDialogScope";

function ChapterManagerDialogContent() {
  const { t } = useTranslation();
  const dialogScope = useChapterManagerDialogScope(undefined);

  return (
    <>
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle {...dialogScope}>{t("timeline.chapters.title")}</DialogTitle>
        <DialogDescription {...dialogScope}>{t("timeline.chapters.description")}</DialogDescription>
      </DialogHeader>

      <ChaptersContent className="-mx-2 px-2">
        <ChaptersList className="py-2" />
      </ChaptersContent>

      <DialogFooter {...dialogScope}>
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

export { ChapterManagerDialogContent };
