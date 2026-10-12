import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import { sourceCleared, sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { editorChaptersFromMedia } from "@/domain/editor-snapshot";
import type { EditorChapter } from "@/domain/media";

import type { RootState } from "../store";

interface ChaptersState {
  items: EditorChapter[];
}

const initialState: ChaptersState = { items: [] };

const chaptersSlice = createSlice({
  name: "chapters",
  initialState,
  reducers: {
    chapterAdded: (state, action: PayloadAction<EditorChapter>) => {
      if (state.items.some((chapter) => chapter.id === action.payload.id)) return;
      state.items.push({ ...action.payload });
      state.items.sort((left, right) => left.startMicros - right.startMicros);
    },
    chapterUpdated: (state, action: PayloadAction<EditorChapter>) => {
      const index = state.items.findIndex((chapter) => chapter.id === action.payload.id);
      if (index === -1) return;
      state.items[index] = { ...action.payload };
      state.items.sort((left, right) => left.startMicros - right.startMicros);
    },
    chapterDeleted: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((chapter) => chapter.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sourceSelected, () => initialState)
      .addCase(sourceCleared, () => initialState)
      .addCase(sourceReady, (_state, action) => ({
        items: action.payload.snapshot?.chapters
          ? action.payload.snapshot.chapters.map((chapter) => ({ ...chapter }))
          : editorChaptersFromMedia(action.payload.media),
      }))
      .addCase(editingInstanceActivated, (_state, action) => ({
        items:
          action.payload.snapshot.chapters?.map((chapter) => ({ ...chapter })) ??
          (action.payload.media ? editorChaptersFromMedia(action.payload.media) : []),
      }));
  },
});

const { chapterAdded, chapterDeleted, chapterUpdated } = chaptersSlice.actions;
const chaptersReducer = chaptersSlice.reducer;
const selectChapters = (state: RootState): EditorChapter[] => state.chapters.items;

export { chapterAdded, chapterDeleted, chaptersReducer, chapterUpdated, selectChapters };
