import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { chapterAdded, selectChapters } from "@/app/store/slices/chapters-slice";
import { createAppStore } from "@/app/store/store";
import type { EditorChapter } from "@/domain/media";
import { firstSource, media } from "@/test/source.fixtures";

import { ChapterTimelineEditingProvider } from "../../ChapterTimelineEditingProvider";
import { useChapterTimelineEditing } from "../chapter-timeline-editing-context";

const chapter: EditorChapter = {
  endMicros: 2_000_000,
  id: "chapter-1",
  startMicros: 1_000_000,
  title: "Opening",
};

function ChapterEditingProbe() {
  const editing = useChapterTimelineEditing();

  return (
    <>
      <output>
        {editing.chapter ? `${editing.chapter.startMicros}-${editing.chapter.endMicros}` : "closed"}
      </output>
      <button onClick={() => editing.edit(chapter)}>Edit chapter</button>
      <button
        onClick={() =>
          editing.updateRange({
            endMicros: 3_500_000,
            sourceDurationMicros: 5_000_000,
            startMicros: 1_500_000,
          })
        }
      >
        Resize chapter
      </button>
      <button onClick={editing.save}>Save chapter</button>
    </>
  );
}

describe("ChapterTimelineEditingProvider", () => {
  it("keeps boundary changes in a draft until Save commits them", () => {
    const store = createAppStore();
    store.dispatch(sourceSelected({ loadToken: 1, source: firstSource }));
    store.dispatch(sourceReady({ loadToken: 1, media: media(firstSource.sourcePath) }));
    store.dispatch(chapterAdded(chapter));

    render(
      <Provider store={store}>
        <ChapterTimelineEditingProvider>
          <ChapterEditingProbe />
        </ChapterTimelineEditingProvider>
      </Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit chapter" }));
    fireEvent.click(screen.getByRole("button", { name: "Resize chapter" }));
    expect(screen.getByText("1500000-3500000")).toBeInTheDocument();
    expect(selectChapters(store.getState())[0]).toEqual(chapter);

    fireEvent.click(screen.getByRole("button", { name: "Save chapter" }));

    expect(selectChapters(store.getState())[0]).toEqual({
      ...chapter,
      endMicros: 3_500_000,
      startMicros: 1_500_000,
    });
    expect(screen.getByText("closed")).toBeInTheDocument();
  });
});
