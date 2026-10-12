import { BookmarkPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";

import { ChapterDraftDialog, ChapterDraftDialogTrigger } from "../ChapterDraftDialog";

import { Chapters, ChaptersContent, ChaptersList } from "./components/Chapters";

function ChapterManagerDialog({ children }: { children: React.ReactNode }) {
  const source = useAppSelector(selectSourceSelection);

  return (
    <Dialog>
      {children}
      <ChapterManagerDialogContent key={source?.sourcePath ?? "no-source"} />
    </Dialog>
  );
}

function ChapterManagerDialogContent() {
  const { t } = useTranslation();

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
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

function ChapterManagerDialogTrigger() {
  const { t } = useTranslation();
  const trim = useAppSelector(selectTrim);

  return (
    <DialogTrigger asChild>
      <Button
        aria-label={t("timeline.chapters.actions.manageChapters")}
        disabled={!trim}
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
