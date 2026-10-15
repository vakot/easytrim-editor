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
import { selectFrameIndex } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { FrameRangeInput, type FrameRangeInputValue } from "@/components/frame-range-input";
import { createTrimFrameAdapter } from "@/domain/trim-frames";

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
  const frameIndex = useAppSelector(selectFrameIndex);
  // The Timeline's frames, so the same frame numbers address the same real frames.
  const adapter = createTrimFrameAdapter(frameIndex);

  // A new chapter spans the selected segment; an existing one keeps its own range.
  const range = chapterId ? chapter : trim;
  const [initialFrames] = useState(() =>
    range
      ? adapter.fromTrim({ ...range, sourceDurationMicros: frameIndex.endMicros })
      : { end: 0, start: 0 },
  );

  const [title, setTitle] = useState(chapter?.title ?? "");
  const [frames, setFrames] = useState<FrameRangeInputValue>({
    end: String(initialFrames.end),
    start: String(initialFrames.start),
  });

  if (!range) return null;

  const trimmedTitle = title.trim();
  const parsedFrames = adapter.parse(frames.start, frames.end);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmedTitle || !parsedFrames) return;
        // Untouched frames keep the exact range, which need not lie on frame boundaries.
        const { endMicros, startMicros } =
          parsedFrames.start === initialFrames.start && parsedFrames.end === initialFrames.end
            ? range
            : adapter.toTrim(parsedFrames);

        if (chapter) {
          dispatch(chapterUpdated({ ...chapter, endMicros, startMicros, title: trimmedTitle }));
        } else {
          dispatch(
            chapterAdded({ endMicros, id: crypto.randomUUID(), startMicros, title: trimmedTitle }),
          );
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
      <FrameRangeInput
        endLabel={t("timeline.chapters.fields.end")}
        error={
          parsedFrames
            ? undefined
            : t("timeline.chapters.status.invalidRange", {
                frames: adapter.lastFrame,
                minimum: adapter.bounds({ start: 0, end: adapter.lastFrame }).minEnd,
              })
        }
        id="chapter-start"
        label={t("timeline.chapters.fields.range")}
        maxFrame={adapter.lastFrame}
        onValueChange={setFrames}
        startLabel={t("timeline.chapters.fields.start")}
        value={frames}
      />
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
        <Button disabled={!trimmedTitle || !parsedFrames} type="submit">
          {t("common.actions.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export { ChapterDialogContent };
