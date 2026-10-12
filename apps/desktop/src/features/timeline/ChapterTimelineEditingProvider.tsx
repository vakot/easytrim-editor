import { type ReactNode, useCallback, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { chapterUpdated, selectChapters } from "@/app/store/slices/chapters-slice";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";

import {
  ChapterTimelineEditingContext,
  type ChapterTimelineEditingValue,
} from "./contexts/chapter-timeline-editing-context";

function ChapterTimelineEditingProvider({ children }: { children: ReactNode }) {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const key = `${activeInstanceId ?? ""}:${sourcePath ?? ""}`;

  return <ChapterTimelineEditingState key={key}>{children}</ChapterTimelineEditingState>;
}

function ChapterTimelineEditingState({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const chapters = useAppSelector(selectChapters);
  const media = useAppSelector(selectSourceMedia);
  const [chapter, setChapter] = useState<ChapterTimelineEditingValue["chapter"]>(null);

  const edit = useCallback((nextChapter: NonNullable<typeof chapter>) => {
    setChapter({ ...nextChapter });
  }, []);

  const updateRange = useCallback(
    (range: Parameters<ChapterTimelineEditingValue["updateRange"]>[0]) => {
      setChapter((current) =>
        current
          ? { ...current, startMicros: range.startMicros, endMicros: range.endMicros }
          : current,
      );
    },
    [],
  );

  const save = useCallback(() => {
    if (
      !chapter ||
      !media ||
      !chapters.some((item) => item.id === chapter.id) ||
      chapter.startMicros < 0 ||
      chapter.endMicros <= chapter.startMicros ||
      chapter.endMicros > media.durationMicros
    ) {
      return;
    }

    dispatch(chapterUpdated(chapter));
    dispatch(commitActiveEditingInstanceDraft());
    setChapter(null);
  }, [chapter, chapters, dispatch, media]);

  return (
    <ChapterTimelineEditingContext.Provider value={{ chapter, edit, save, updateRange }}>
      {children}
    </ChapterTimelineEditingContext.Provider>
  );
}

export { ChapterTimelineEditingProvider };
