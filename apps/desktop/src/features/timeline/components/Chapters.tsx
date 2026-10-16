import { BookmarkPlus, Pencil, Trash2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { chapterDeleted, selectChapters } from "@/app/store/slices/chapters-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import type { EditorChapter } from "@/domain/media";
import { cn } from "@/lib/class-names.utils";

import { ChapterDialog, ChapterDialogTrigger } from "../dialogs/ChapterDialog";
import { formatTimecode } from "../lib/timecode";

function ChaptersContent({ className, ...props }: ComponentProps<typeof ScrollArea>) {
  const chapters = useAppSelector(selectChapters);
  if (!chapters.length) return <ChaptersEmpty />;

  return (
    <ScrollArea
      className={cn("min-h-0 flex-1", className)}
      data-testid="chapters-scroll-area"
      {...props}
    />
  );
}

function ChaptersList({ className, ...props }: Omit<ComponentProps<"ul">, "children">) {
  const chapters = useAppSelector(selectChapters);

  return (
    <ul className={cn("grid gap-3", className)} {...props}>
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <ChaptersListItem chapter={chapter} />
        </li>
      ))}
    </ul>
  );
}

function ChaptersListItem({ chapter }: { chapter: EditorChapter }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const media = useAppSelector(selectSourceMedia);
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{chapter.title}</ItemTitle>
        <ItemDescription>
          {formatTimecode(chapter.startMicros, frameRate)} –{" "}
          {formatTimecode(chapter.endMicros, frameRate)}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <ChapterDialog chapterId={chapter.id}>
          <ChapterDialogTrigger asChild>
            <Button
              aria-label={t("timeline.chapters.actions.editChapter", { title: chapter.title })}
              size="icon-sm"
              type="button"
              variant="secondary"
            >
              <Pencil />
            </Button>
          </ChapterDialogTrigger>
        </ChapterDialog>

        <Button
          aria-label={t("timeline.chapters.actions.deleteChapter", { title: chapter.title })}
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
  const { t } = useTranslation();

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

export { ChaptersContent, ChaptersEmpty, ChaptersList };
