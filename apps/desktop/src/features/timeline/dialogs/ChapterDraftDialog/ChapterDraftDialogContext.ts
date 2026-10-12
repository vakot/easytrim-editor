import { createContext, useContext } from "react";

import type { EditorChapter } from "@/domain/media";

const ChapterDraftContext = createContext<{
  draft: EditorChapter;
  setDraft: React.Dispatch<React.SetStateAction<EditorChapter>>;
} | null>(null);

function useChapterDraft() {
  const context = useContext(ChapterDraftContext);

  if (!context) {
    throw new Error(
      "ChapterDraftDialogTrigger and ChapterDraftDialogContent must be used within ChapterDraftDialog",
    );
  }

  return context;
}

export { ChapterDraftContext, useChapterDraft };
