import { t } from "i18next";
import { BookmarkPlus, Pencil, Trash2 } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { chapterDeleted, selectChapters } from "@/app/store/slices/chapters-slice";
import type { EditorChapter } from "@/domain/media";
import { formatPlaybackTime } from "@/domain/playback";
import { cn } from "@/lib/class-names.utils";

import { ChapterDraftDialog, ChapterDraftDialogTrigger } from "../../ChapterDraftDialog";

function Chapters({ children }: { children: React.ReactNode }) {
  return <ChapterDraftDialog>{children}</ChapterDraftDialog>;
}

function ChaptersContent({ className, ...props }: React.ComponentProps<typeof ScrollArea>) {
  const chapters = useAppSelector(selectChapters);
  if (!chapters) return <ChaptersEmpty />;
  return (
    <ScrollArea
      className={cn("min-h-0 flex-1", className)}
      data-testid="chapters-scroll-area"
      {...props}
    />
  );
}

function ChaptersList() {
  const chapters = useAppSelector(selectChapters);

  return (
    <ul className="grid gap-3">
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <ChaptersListItem chapter={chapter} />
        </li>
      ))}
    </ul>
  );
}

function ChaptersListItem({ chapter }: { chapter: EditorChapter }) {
  const dispatch = useAppDispatch();

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{chapter.title}</ItemTitle>
        <ItemDescription>
          {formatPlaybackTime(chapter.startMicros, undefined)} –{" "}
          {formatPlaybackTime(chapter.endMicros, undefined)}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <ChapterDraftDialogTrigger draft={chapter}>
          <Button
            aria-label={t("timeline.chapters.actions.editChapter", {
              title: chapter.title,
            })}
            size="icon-sm"
            type="button"
            variant="secondary"
          >
            <Pencil />
          </Button>
        </ChapterDraftDialogTrigger>

        <Button
          aria-label={t("timeline.chapters.actions.deleteChapter", {
            title: chapter.title,
          })}
          onClick={() => dispatch(chapterDeleted(chapter.id))}
          size="icon-sm"
          type="button"
          variant="destructive"
        >
          <Trash2 />
        </Button>
      </ItemActions>
    </Item>
  );
}

function ChaptersEmpty() {
  return (
    <Empty className="gap-2 border-0 p-4">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BookmarkPlus aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="text-sm font-normal tracking-normal">
          {t("timeline.chapters.empty")}
        </EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

export { Chapters, ChaptersContent, ChaptersEmpty, ChaptersList };
