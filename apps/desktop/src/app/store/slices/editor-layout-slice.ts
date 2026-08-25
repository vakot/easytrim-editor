import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store/store";

export type EditorLayoutMap = Record<string, number>;

export interface EditorLayoutState {
  showSourceDetails: boolean;
  showTimeline: boolean;
  workspaceLayout: EditorLayoutMap | undefined;
  editorStageLayout: EditorLayoutMap | undefined;
}

export function createInitialEditorLayoutState(): EditorLayoutState {
  return {
    showSourceDetails: true,
    showTimeline: true,
    workspaceLayout: undefined,
    editorStageLayout: undefined,
  };
}

const editorLayoutSlice = createSlice({
  name: "editorLayout",
  initialState: createInitialEditorLayoutState,
  reducers: {
    sourceDetailsVisibilityChanged: (state, action: PayloadAction<boolean>) => {
      state.showSourceDetails = action.payload;
    },
    timelineVisibilityChanged: (state, action: PayloadAction<boolean>) => {
      state.showTimeline = action.payload;
    },
    workspaceLayoutChanged: (state, action: PayloadAction<EditorLayoutMap>) => {
      state.workspaceLayout = action.payload;
    },
    editorStageLayoutChanged: (state, action: PayloadAction<EditorLayoutMap>) => {
      state.editorStageLayout = action.payload;
    },
    editorLayoutReset: () => createInitialEditorLayoutState(),
  },
});

export const {
  sourceDetailsVisibilityChanged,
  timelineVisibilityChanged,
  workspaceLayoutChanged,
  editorStageLayoutChanged,
  editorLayoutReset,
} = editorLayoutSlice.actions;
export const editorLayoutReducer = editorLayoutSlice.reducer;

export const selectEditorLayout = (state: RootState): EditorLayoutState => state.editorLayout;
export const selectShowSourceDetails = (state: RootState): boolean =>
  selectEditorLayout(state).showSourceDetails;
export const selectShowTimeline = (state: RootState): boolean =>
  selectEditorLayout(state).showTimeline;
export const selectWorkspaceLayout = (state: RootState): EditorLayoutMap | undefined =>
  selectEditorLayout(state).workspaceLayout;
export const selectEditorStageLayout = (state: RootState): EditorLayoutMap | undefined =>
  selectEditorLayout(state).editorStageLayout;
