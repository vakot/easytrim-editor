import { createContext, useContext } from "react";

interface ChapterEditing {
  /** The chapter whose position the timeline edits, if any. */
  chapterId: string | null;
  /** Starts editing a chapter's position on the timeline, or finishes with `null`. */
  edit: (chapterId: string | null) => void;
  /** Opens the dialog for the edited chapter's name. */
  openDialog: () => void;
}

const ChapterEditingContext = createContext<ChapterEditing | null>(null);

function useChapterEditing() {
  const context = useContext(ChapterEditingContext);
  if (!context) throw new Error("Chapter editing must be used within TimelinePanel.");
  return context;
}

export { ChapterEditingContext, useChapterEditing };
export type { ChapterEditing };
