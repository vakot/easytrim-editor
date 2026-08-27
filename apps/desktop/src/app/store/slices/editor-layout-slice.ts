import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store/store";

export const EDITOR_PANEL_IDS = {
  sourceDetails: "source-details",
  timeline: "timeline",
  sidebarMedia: "sidebar.media",
  sidebarImportedQueue: "sidebar.imported-queue",
  sidebarExportQueue: "sidebar.export-queue",
} as const;

export type EditorPanelId = (typeof EDITOR_PANEL_IDS)[keyof typeof EDITOR_PANEL_IDS];

export interface EditorPanelState {
  visible: boolean;
  collapsed: boolean;
}

export interface EditorLayoutState {
  panels: Record<EditorPanelId, EditorPanelState>;
}

const createExpandedPanelState = (): EditorPanelState => ({
  visible: true,
  collapsed: false,
});

export function createInitialEditorLayoutState(): EditorLayoutState {
  return {
    panels: {
      [EDITOR_PANEL_IDS.sourceDetails]: createExpandedPanelState(),
      [EDITOR_PANEL_IDS.timeline]: createExpandedPanelState(),
      [EDITOR_PANEL_IDS.sidebarMedia]: createExpandedPanelState(),
      [EDITOR_PANEL_IDS.sidebarImportedQueue]: createExpandedPanelState(),
      [EDITOR_PANEL_IDS.sidebarExportQueue]: createExpandedPanelState(),
    },
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
      if (action.payload.panelId === EDITOR_PANEL_IDS.sidebarMedia) return;
      const panel = state.panels[action.payload.panelId];
      panel.visible = action.payload.visible;
      panel.collapsed = false;
    },
    panelVisibilityToggled: (state, action: PayloadAction<EditorPanelId>) => {
      if (action.payload === EDITOR_PANEL_IDS.sidebarMedia) return;
      const panel = state.panels[action.payload];
      panel.visible = !panel.visible;
      panel.collapsed = false;
    },
    panelCollapsedChanged: (
      state,
      action: PayloadAction<{ panelId: EditorPanelId; collapsed: boolean }>,
    ) => {
      const panel = state.panels[action.payload.panelId];
      if (!panel.visible) return;
      panel.collapsed = action.payload.collapsed;
    },
    panelCollapseToggled: (state, action: PayloadAction<EditorPanelId>) => {
      const panel = state.panels[action.payload];
      if (!panel.visible) return;
      panel.collapsed = !panel.collapsed;
    },
    editorLayoutReset: () => createInitialEditorLayoutState(),
  },
});

export const {
  panelVisibilityChanged,
  panelVisibilityToggled,
  panelCollapsedChanged,
  panelCollapseToggled,
  editorLayoutReset,
} = editorLayoutSlice.actions;
export const editorLayoutReducer = editorLayoutSlice.reducer;

export const selectEditorLayout = (state: RootState): EditorLayoutState => state.editorLayout;
export const selectEditorPanel = (state: RootState, panelId: EditorPanelId): EditorPanelState =>
  selectEditorLayout(state).panels[panelId];
export const selectPanelVisibility = (state: RootState, panelId: EditorPanelId): boolean =>
  selectEditorPanel(state, panelId).visible;
export const selectPanelCollapsed = (state: RootState, panelId: EditorPanelId): boolean =>
  selectEditorPanel(state, panelId).collapsed;
export const selectPanelExpanded = (state: RootState, panelId: EditorPanelId): boolean => {
  const panel = selectEditorPanel(state, panelId);
  return panel.visible && !panel.collapsed;
};
