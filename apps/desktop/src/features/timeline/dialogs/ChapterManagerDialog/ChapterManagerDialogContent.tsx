import { BookmarkPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ChapterDraftDialog, ChapterDraftDialogTrigger } from "../ChapterDraftDialog";

import { Chapters, ChaptersContent, ChaptersList } from "./components/Chapters";

function ChapterManagerDialogContent({ sourceKey }: { sourceKey: string }) {
  const { t } = useTranslation();

  return (
    <DialogContent
      className="h-[min(80dvh,40rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden sm:max-w-lg"
      key={sourceKey}
    >
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle>{t("timeline.chapters.title")}</DialogTitle>
        <DialogDescription>{t("timeline.chapters.description")}</DialogDescription>
      </DialogHeader>

      <Chapters>
        <ChaptersContent>
          <ChaptersList />
        </ChaptersContent>
      </Chapters>

      <DialogFooter>
        <ChapterDraftDialog>
          <ChapterDraftDialogTrigger asChild>
            <Button type="button">
              <BookmarkPlus /> {t("timeline.chapters.actions.addChapter")}
            </Button>
          </ChapterDraftDialogTrigger>
        </ChapterDraftDialog>
      </DialogFooter>
    </DialogContent>
  );
}

export { ChapterManagerDialogContent };
