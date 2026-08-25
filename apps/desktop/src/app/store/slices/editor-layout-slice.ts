import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store/store";

export type EditorLayoutMap = Record<string, number>;
export type EditorPanelId = "left" | "bottom";

export interface EditorLayoutState {
  panelVisibility: Record<EditorPanelId, boolean>;
  workspaceLayout: EditorLayoutMap | undefined;
  editorStageLayout: EditorLayoutMap | undefined;
}

export function createInitialEditorLayoutState(): EditorLayoutState {
  return {
    panelVisibility: {
      left: true,
      bottom: true,
    },
    workspaceLayout: undefined,
    editorStageLayout: undefined,
  };
}

const editorLayoutSlice = createSlice({
  name: "editorLayout",
  initialState: createInitialEditorLayoutState,
  reducers: {
    panelVisibilityChanged: (
      state,
      action: PayloadAction<{ panelId: EditorPanelId; visible: boolean }>,
    ) => {
      state.panelVisibility[action.payload.panelId] = action.payload.visible;
    },
    panelToggled: (state, action: PayloadAction<EditorPanelId>) => {
      state.panelVisibility[action.payload] = !state.panelVisibility[action.payload];
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
  panelVisibilityChanged,
  panelToggled,
  workspaceLayoutChanged,
  editorStageLayoutChanged,
  editorLayoutReset,
} = editorLayoutSlice.actions;
export const editorLayoutReducer = editorLayoutSlice.reducer;

export const selectEditorLayout = (state: RootState): EditorLayoutState => state.editorLayout;
export const selectPanelVisibility = (state: RootState, panelId: EditorPanelId): boolean =>
  selectEditorLayout(state).panelVisibility[panelId];
export const selectWorkspaceLayout = (state: RootState): EditorLayoutMap | undefined =>
  selectEditorLayout(state).workspaceLayout;
export const selectEditorStageLayout = (state: RootState): EditorLayoutMap | undefined =>
  selectEditorLayout(state).editorStageLayout;
