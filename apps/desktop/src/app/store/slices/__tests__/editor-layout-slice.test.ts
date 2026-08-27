import { describe, expect, it } from "vitest";

import type { RootState } from "@/app/store/store";
import {
  EDITOR_PANEL_IDS,
  createInitialEditorLayoutState,
  editorLayoutReducer,
  editorPanelsResetToDefault,
  panelCollapseToggled,
  panelCollapsedChanged,
  panelVisibilityChanged,
  panelVisibilityToggled,
  selectEditorLayout,
  selectEditorPanel,
  selectPanelCollapsed,
  selectPanelExpanded,
  selectPanelVisibility,
} from "@/app/store/slices/editor-layout-slice";

describe("editor layout Redux domain", () => {
  it("starts with every editor panel visible and expanded", () => {
    expect(editorLayoutReducer(undefined, { type: "unknown" })).toEqual(
      createInitialEditorLayoutState(),
    );
  });

  it("changes panel visibility independently", () => {
    const state = editorLayoutReducer(
      editorLayoutReducer(
        undefined,
        panelVisibilityChanged({ panelId: EDITOR_PANEL_IDS.sourceDetails, visible: false }),
      ),
      panelVisibilityChanged({ panelId: EDITOR_PANEL_IDS.sidebarExportQueue, visible: false }),
    );

    expect(state.panels[EDITOR_PANEL_IDS.sourceDetails]).toEqual({
      visible: false,
      collapsed: false,
    });
    expect(state.panels[EDITOR_PANEL_IDS.sidebarExportQueue]).toEqual({
      visible: false,
      collapsed: false,
    });
    expect(state.panels[EDITOR_PANEL_IDS.timeline]).toEqual({
      visible: true,
      collapsed: false,
    });
  });

  it("toggles visibility with the generic panel identifier", () => {
    const state = editorLayoutReducer(
      undefined,
      panelVisibilityToggled(EDITOR_PANEL_IDS.sidebarImportedQueue),
    );

    expect(state.panels[EDITOR_PANEL_IDS.sidebarImportedQueue]).toEqual({
      visible: false,
      collapsed: false,
    });
  });

  it("uses collapsed as a distinct rendered panel state", () => {
    const collapsedState = editorLayoutReducer(
      undefined,
      panelCollapsedChanged({ panelId: EDITOR_PANEL_IDS.timeline, collapsed: true }),
    );
    const expandedState = editorLayoutReducer(
      collapsedState,
      panelCollapseToggled(EDITOR_PANEL_IDS.timeline),
    );

    expect(collapsedState.panels[EDITOR_PANEL_IDS.timeline]).toEqual({
      visible: true,
      collapsed: true,
    });
    expect(expandedState.panels[EDITOR_PANEL_IDS.timeline]).toEqual({
      visible: true,
      collapsed: false,
    });
  });

  it("selectively resets any combination of panel values", () => {
    const changedState = editorLayoutReducer(
      editorLayoutReducer(
        undefined,
        panelVisibilityChanged({ panelId: EDITOR_PANEL_IDS.sourceDetails, visible: false }),
      ),
      panelVisibilityChanged({ panelId: EDITOR_PANEL_IDS.sidebarExportQueue, visible: false }),
    );
    const collapsedState = editorLayoutReducer(
      changedState,
      panelCollapsedChanged({ panelId: EDITOR_PANEL_IDS.timeline, collapsed: true }),
    );
    const resetState = editorLayoutReducer(
      collapsedState,
      editorPanelsResetToDefault([
        { panelId: EDITOR_PANEL_IDS.sourceDetails, resetVisible: true },
        { panelId: EDITOR_PANEL_IDS.timeline, resetCollapsed: true, resetSize: true },
      ]),
    );

    expect(resetState.panels[EDITOR_PANEL_IDS.sourceDetails].visible).toBe(true);
    expect(resetState.panels[EDITOR_PANEL_IDS.timeline].collapsed).toBe(false);
    expect(resetState.panels[EDITOR_PANEL_IDS.sidebarExportQueue].visible).toBe(false);
  });

  it("exposes focused selectors and serializable panel actions", () => {
    const editorLayout = createInitialEditorLayoutState();
    editorLayout.panels[EDITOR_PANEL_IDS.sourceDetails] = {
      visible: false,
      collapsed: false,
    };
    editorLayout.panels[EDITOR_PANEL_IDS.timeline] = {
      visible: true,
      collapsed: true,
    };
    const state = { editorLayout } as unknown as RootState;

    expect(selectEditorLayout(state)).toBe(editorLayout);
    expect(selectEditorPanel(state, EDITOR_PANEL_IDS.timeline)).toBe(
      editorLayout.panels[EDITOR_PANEL_IDS.timeline],
    );
    expect(selectPanelVisibility(state, EDITOR_PANEL_IDS.sourceDetails)).toBe(false);
    expect(selectPanelCollapsed(state, EDITOR_PANEL_IDS.timeline)).toBe(true);
    expect(selectPanelExpanded(state, EDITOR_PANEL_IDS.timeline)).toBe(false);
    expect(
      JSON.parse(
        JSON.stringify(
          panelCollapsedChanged({ panelId: EDITOR_PANEL_IDS.timeline, collapsed: true }),
        ),
      ),
    ).toEqual({
      type: "editorLayout/panelCollapsedChanged",
      payload: { panelId: EDITOR_PANEL_IDS.timeline, collapsed: true },
    });
  });
});
