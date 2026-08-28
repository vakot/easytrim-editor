import { describe, expect, it } from "vitest";

import {
  PANEL_IDS,
  createInitialPanelLayoutState,
  panelCollapseToggled,
  panelCollapsedChanged,
  panelLayoutReducer,
  panelVisibilityChanged,
  panelVisibilityToggled,
  panelsResetToDefault,
  selectPanel,
  selectPanelCollapsed,
  selectPanelExpanded,
  selectPanelLayout,
  selectPanelVisibility,
} from "@/app/store/slices/panel-layout-slice";
import type { RootState } from "@/app/store/store";

describe("panel layout Redux domain", () => {
  it("starts with every panel visible and expanded", () => {
    expect(panelLayoutReducer(undefined, { type: "unknown" })).toEqual(
      createInitialPanelLayoutState(),
    );
  });

  it("changes panel visibility independently", () => {
    const state = panelLayoutReducer(
      panelLayoutReducer(
        undefined,
        panelVisibilityChanged({ panelId: PANEL_IDS.sourceDetails, visible: false }),
      ),
      panelVisibilityChanged({ panelId: PANEL_IDS.sidebarExportQueue, visible: false }),
    );

    expect(state.panels[PANEL_IDS.sourceDetails]).toEqual({
      visible: false,
      collapsed: false,
    });
    expect(state.panels[PANEL_IDS.sidebarExportQueue]).toEqual({
      visible: false,
      collapsed: false,
    });
    expect(state.panels[PANEL_IDS.timeline]).toEqual({
      visible: true,
      collapsed: false,
    });
  });

  it("toggles visibility with the generic panel identifier", () => {
    const state = panelLayoutReducer(
      undefined,
      panelVisibilityToggled(PANEL_IDS.sidebarimportQueue),
    );

    expect(state.panels[PANEL_IDS.sidebarimportQueue]).toEqual({
      visible: false,
      collapsed: false,
    });
  });

  it("uses collapsed as a distinct rendered panel state", () => {
    const collapsedState = panelLayoutReducer(
      undefined,
      panelCollapsedChanged({ panelId: PANEL_IDS.timeline, collapsed: true }),
    );
    const expandedState = panelLayoutReducer(
      collapsedState,
      panelCollapseToggled(PANEL_IDS.timeline),
    );

    expect(collapsedState.panels[PANEL_IDS.timeline]).toEqual({
      visible: true,
      collapsed: true,
    });
    expect(expandedState.panels[PANEL_IDS.timeline]).toEqual({
      visible: true,
      collapsed: false,
    });
  });

  it("selectively resets any combination of panel values", () => {
    const changedState = panelLayoutReducer(
      panelLayoutReducer(
        undefined,
        panelVisibilityChanged({ panelId: PANEL_IDS.sourceDetails, visible: false }),
      ),
      panelVisibilityChanged({ panelId: PANEL_IDS.sidebarExportQueue, visible: false }),
    );
    const collapsedState = panelLayoutReducer(
      changedState,
      panelCollapsedChanged({ panelId: PANEL_IDS.timeline, collapsed: true }),
    );
    const resetState = panelLayoutReducer(
      collapsedState,
      panelsResetToDefault([
        { panelId: PANEL_IDS.sourceDetails, resetVisible: true },
        { panelId: PANEL_IDS.timeline, resetCollapsed: true, resetSize: true },
      ]),
    );

    expect(resetState.panels[PANEL_IDS.sourceDetails].visible).toBe(true);
    expect(resetState.panels[PANEL_IDS.timeline].collapsed).toBe(false);
    expect(resetState.panels[PANEL_IDS.sidebarExportQueue].visible).toBe(false);
  });

  it("exposes focused selectors and serializable panel actions", () => {
    const panelLayout = createInitialPanelLayoutState();
    panelLayout.panels[PANEL_IDS.sourceDetails] = {
      visible: false,
      collapsed: false,
    };
    panelLayout.panels[PANEL_IDS.timeline] = {
      visible: true,
      collapsed: true,
    };
    const state = { panelLayout } as unknown as RootState;

    expect(selectPanelLayout(state)).toBe(panelLayout);
    expect(selectPanel(state, PANEL_IDS.timeline)).toBe(panelLayout.panels[PANEL_IDS.timeline]);
    expect(selectPanelVisibility(state, PANEL_IDS.sourceDetails)).toBe(false);
    expect(selectPanelCollapsed(state, PANEL_IDS.timeline)).toBe(true);
    expect(selectPanelExpanded(state, PANEL_IDS.timeline)).toBe(false);
    expect(
      JSON.parse(
        JSON.stringify(panelCollapsedChanged({ panelId: PANEL_IDS.timeline, collapsed: true })),
      ),
    ).toEqual({
      type: "panelLayout/panelCollapsedChanged",
      payload: { panelId: PANEL_IDS.timeline, collapsed: true },
    });
  });
});
