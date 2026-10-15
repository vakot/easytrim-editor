import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  chapterAdded,
  chapterDeleted,
  chapterUpdated,
  selectChapters,
} from "@/app/store/slices/chapters-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";

import { useChapterEditing } from "../../contexts/chapter-editing-context";
import { formatTimecode } from "../../lib/timecode";

import { useChapterDialogScope } from "./hooks/useChapterDialogScope";

interface ChapterDialogContentProps {
  chapterId?: string;
  onClose: () => void;
}

function ChapterDialogContent({ chapterId, onClose }: ChapterDialogContentProps) {
  const { t } = useTranslation();
  const dialogScope = useChapterDialogScope(undefined);
  const dispatch = useAppDispatch();
  const chapter = useAppSelector(selectChapters).find(({ id }) => id === chapterId);
  const trim = useAppSelector(selectTrim);
  const media = useAppSelector(selectSourceMedia);
  const chapterEditing = useChapterEditing();
  const [title, setTitle] = useState(chapter?.title ?? "");

  // A new chapter spans the selected segment; an existing one keeps its own range.
  const range = chapterId ? chapter : trim;
  if (!range) return null;

  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const trimmedTitle = title.trim();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmedTitle) return;
        if (chapter) {
          dispatch(chapterUpdated({ ...chapter, title: trimmedTitle }));
        } else {
          const id = crypto.randomUUID();
          dispatch(
            chapterAdded({
              endMicros: range.endMicros,
              id,
              startMicros: range.startMicros,
              title: trimmedTitle,
            }),
          );
          // A new chapter goes straight to the timeline to be positioned.
          chapterEditing.edit(id);
        }
        onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle {...dialogScope}>
          {chapter
            ? t("timeline.chapters.actions.editChapter", { title: chapter.title })
            : t("timeline.chapters.actions.addChapter")}
        </DialogTitle>
        <DialogDescription {...dialogScope}>{t("timeline.chapters.description")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="chapter-title">{t("timeline.chapters.fields.title")}</Label>
        <Input
          autoComplete="off"
          autoFocus
          id="chapter-title"
          maxLength={256}
          onChange={(event) => setTitle(event.currentTarget.value)}
          value={title}
        />
      </div>
      <dl className="m-0 grid gap-1">
        <dt className="text-sm font-medium">{t("timeline.chapters.fields.range")}</dt>
        <dd className="m-0 font-mono text-xs text-muted-foreground tabular-nums">
          {formatTimecode(range.startMicros, frameRate)} –{" "}
          {formatTimecode(range.endMicros, frameRate)}
        </dd>
        <dd className="m-0 text-xs text-muted-foreground">{t("timeline.chapters.rangeHint")}</dd>
      </dl>
      <DialogFooter showCloseButton {...dialogScope}>
        {chapter ? (
          <Button
            aria-label={t("timeline.chapters.actions.deleteChapter", { title: chapter.title })}
            className="sm:order-first sm:mr-auto"
            onClick={() => {
              dispatch(chapterDeleted(chapter.id));
              onClose();
            }}
            size="icon"
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
        <Button disabled={!trimmedTitle} type="submit">
          {t("common.actions.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export { ChapterDialogContent };
