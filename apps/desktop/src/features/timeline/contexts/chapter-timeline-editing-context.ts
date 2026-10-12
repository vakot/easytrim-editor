import { createContext, useContext } from "react";

import type { EditorChapter } from "@/domain/media";
import type { TrimRange } from "@/domain/trim";

interface ChapterTimelineEditingValue {
  chapter: EditorChapter | null;
  edit: (chapter: EditorChapter) => void;
  save: () => void;
  updateRange: (range: TrimRange) => void;
}

const ChapterTimelineEditingContext = createContext<ChapterTimelineEditingValue | null>(null);

function useChapterTimelineEditing() {
  const context = useContext(ChapterTimelineEditingContext);
  if (!context) {
    throw new Error("Chapter timeline editing must be used within ChapterTimelineEditingProvider.");
  }
  return context;
}

export { ChapterTimelineEditingContext, useChapterTimelineEditing };
export type { ChapterTimelineEditingValue };
