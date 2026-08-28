import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store/store";

export const PANEL_IDS = {
  sourceDetails: "source-details",
  timeline: "timeline",
  sidebarMedia: "sidebar.media",
  sidebarimportQueue: "sidebar.imported-queue",
  sidebarExportQueue: "sidebar.export-queue",
} as const;

export type PanelId = (typeof PANEL_IDS)[keyof typeof PANEL_IDS];

export interface PanelState {
  visible: boolean;
  collapsed: boolean;
}

export interface PanelLayoutState {
  panels: Record<PanelId, PanelState>;
}

export interface PanelResetRequest {
  panelId: PanelId;
  resetCollapsed?: boolean;
  resetSize?: boolean;
  resetVisible?: boolean;
}

const createExpandedPanelState = (): PanelState => ({
  visible: true,
  collapsed: false,
});

export function createInitialPanelLayoutState(): PanelLayoutState {
  return {
    panels: {
      [PANEL_IDS.sourceDetails]: createExpandedPanelState(),
      [PANEL_IDS.timeline]: createExpandedPanelState(),
      [PANEL_IDS.sidebarMedia]: createExpandedPanelState(),
      [PANEL_IDS.sidebarimportQueue]: createExpandedPanelState(),
      [PANEL_IDS.sidebarExportQueue]: createExpandedPanelState(),
    },
  };
}

const panelLayoutSlice = createSlice({
  name: "panelLayout",
  initialState: createInitialPanelLayoutState,
  reducers: {
    panelVisibilityChanged: (
      state,
      action: PayloadAction<{ panelId: PanelId; visible: boolean }>,
    ) => {
      if (action.payload.panelId === PANEL_IDS.sidebarMedia) {
        state.panels[PANEL_IDS.sidebarMedia].visible = true;
        return;
      }
      const panel = state.panels[action.payload.panelId];
      panel.visible = action.payload.visible;
      panel.collapsed = false;
    },
    panelVisibilityToggled: (state, action: PayloadAction<PanelId>) => {
      if (action.payload === PANEL_IDS.sidebarMedia) {
        state.panels[PANEL_IDS.sidebarMedia].visible = true;
        return;
      }
      const panel = state.panels[action.payload];
      panel.visible = !panel.visible;
      panel.collapsed = false;
    },
    panelCollapsedChanged: (
      state,
      action: PayloadAction<{ panelId: PanelId; collapsed: boolean }>,
    ) => {
      const panel = state.panels[action.payload.panelId];
      if (action.payload.panelId === PANEL_IDS.sidebarMedia) panel.visible = true;
      if (!panel.visible) return;
      panel.collapsed = action.payload.collapsed;
    },
    panelCollapseToggled: (state, action: PayloadAction<PanelId>) => {
      const panel = state.panels[action.payload];
      if (action.payload === PANEL_IDS.sidebarMedia) panel.visible = true;
      if (!panel.visible) return;
      panel.collapsed = !panel.collapsed;
    },
    panelsResetToDefault: (state, action: PayloadAction<readonly PanelResetRequest[]>) => {
      const defaults = createInitialPanelLayoutState();

      action.payload.forEach(({ panelId, resetCollapsed, resetVisible }) => {
        const panel = state.panels[panelId];
        const defaultPanel = defaults.panels[panelId];

        if (resetVisible) panel.visible = defaultPanel.visible;
        if (resetCollapsed) panel.collapsed = defaultPanel.collapsed;
      });
    },
  },
});

export const {
  panelVisibilityChanged,
  panelVisibilityToggled,
  panelCollapsedChanged,
  panelCollapseToggled,
  panelsResetToDefault,
} = panelLayoutSlice.actions;
export const panelLayoutReducer = panelLayoutSlice.reducer;

export const selectPanelLayout = (state: RootState): PanelLayoutState => state.panelLayout;
export const selectPanel = (state: RootState, panelId: PanelId): PanelState =>
  selectPanelLayout(state).panels[panelId];
export const selectPanelVisibility = (state: RootState, panelId: PanelId): boolean =>
  selectPanel(state, panelId).visible;
export const selectPanelCollapsed = (state: RootState, panelId: PanelId): boolean =>
  selectPanel(state, panelId).collapsed;
export const selectPanelExpanded = (state: RootState, panelId: PanelId): boolean => {
  const panel = selectPanel(state, panelId);
  return panel.visible && !panel.collapsed;
};
