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
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const chapters = useAppSelector(selectChapters);
  const media = useAppSelector(selectSourceMedia);
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const sourceIdentity = `${activeInstanceId ?? ""}:${sourcePath ?? ""}`;
  const [editingState, setEditingState] = useState<{
    chapter: ChapterTimelineEditingValue["chapter"];
    sourceIdentity: string;
  }>({ chapter: null, sourceIdentity });

  if (editingState.sourceIdentity !== sourceIdentity) {
    setEditingState({ chapter: null, sourceIdentity });
  }

  const chapter = editingState.chapter;
  const edit = useCallback(
    (nextChapter: NonNullable<typeof chapter>) => {
      setEditingState({ chapter: { ...nextChapter }, sourceIdentity });
    },
    [sourceIdentity],
  );

  const updateRange = useCallback(
    (range: Parameters<ChapterTimelineEditingValue["updateRange"]>[0]) => {
      setEditingState((current) =>
        current.sourceIdentity === sourceIdentity && current.chapter
          ? {
              chapter: {
                ...current.chapter,
                startMicros: range.startMicros,
                endMicros: range.endMicros,
              },
              sourceIdentity,
            }
          : current,
      );
    },
    [sourceIdentity],
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
    setEditingState({ chapter: null, sourceIdentity });
  }, [chapter, chapters, dispatch, media, sourceIdentity]);

  return (
    <ChapterTimelineEditingContext.Provider value={{ chapter, edit, save, updateRange }}>
      {children}
    </ChapterTimelineEditingContext.Provider>
  );
}

export { ChapterTimelineEditingProvider };
