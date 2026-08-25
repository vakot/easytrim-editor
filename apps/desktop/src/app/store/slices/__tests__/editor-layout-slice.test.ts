import { describe, expect, it } from "vitest";

import type { RootState } from "@/app/store/store";
import {
  createInitialEditorLayoutState,
  editorLayoutReducer,
  editorLayoutReset,
  editorStageLayoutChanged,
  selectEditorLayout,
  selectEditorStageLayout,
  selectPanelVisibility,
  selectWorkspaceLayout,
  panelToggled,
  panelVisibilityChanged,
  workspaceLayoutChanged,
} from "@/app/store/slices/editor-layout-slice";

describe("editor layout Redux domain", () => {
  it("starts with deterministic visible panels and uninitialized layouts", () => {
    expect(editorLayoutReducer(undefined, { type: "unknown" })).toEqual(
      createInitialEditorLayoutState(),
    );
  });

  it("changes visibility independently", () => {
    const initialState = editorLayoutReducer(undefined, { type: "unknown" });
    const nextState = editorLayoutReducer(
      editorLayoutReducer(
        initialState,
        panelVisibilityChanged({ panelId: "left", visible: false }),
      ),
      panelVisibilityChanged({ panelId: "bottom", visible: false }),
    );

    expect(nextState.panelVisibility).toEqual({ left: false, bottom: false });
    expect(nextState.workspaceLayout).toBeUndefined();
    expect(nextState.editorStageLayout).toBeUndefined();
  });

  it("toggles a panel by its generic identifier", () => {
    const initialState = editorLayoutReducer(undefined, { type: "unknown" });

    expect(editorLayoutReducer(initialState, panelToggled("left")).panelVisibility).toEqual({
      left: false,
      bottom: true,
    });
  });

  it("stores workspace and editor-stage layouts independently", () => {
    const workspaceLayout = { "source-details-panel": 25, "editor-content-panel": 75 };
    const editorStageLayout = { "preview-panel": 70, "timeline-panel": 30 };
    const state = editorLayoutReducer(
      editorLayoutReducer(undefined, workspaceLayoutChanged(workspaceLayout)),
      editorStageLayoutChanged(editorStageLayout),
    );

    expect(state.workspaceLayout).toBe(workspaceLayout);
    expect(state.editorStageLayout).toBe(editorStageLayout);
    expect(state.panelVisibility).toEqual({ left: true, bottom: true });
  });

  it("resets the whole layout domain in one operation", () => {
    const changedState = editorLayoutReducer(
      editorLayoutReducer(
        editorLayoutReducer(undefined, panelVisibilityChanged({ panelId: "left", visible: false })),
        workspaceLayoutChanged({ "source-details-panel": 40, "editor-content-panel": 60 }),
      ),
      editorStageLayoutChanged({ "preview-panel": 60, "timeline-panel": 40 }),
    );

    expect(editorLayoutReducer(changedState, editorLayoutReset())).toEqual(
      createInitialEditorLayoutState(),
    );
  });

  it("exposes focused selectors and serializable layout actions", () => {
    const editorLayout = {
      panelVisibility: { left: false, bottom: true },
      workspaceLayout: { "source-details-panel": 20, "editor-content-panel": 80 },
      editorStageLayout: { "preview-panel": 75, "timeline-panel": 25 },
    };
    const state = { editorLayout } as unknown as RootState;

    expect(selectEditorLayout(state)).toBe(editorLayout);
    expect(selectPanelVisibility(state, "left")).toBe(false);
    expect(selectPanelVisibility(state, "bottom")).toBe(true);
    expect(selectWorkspaceLayout(state)).toBe(editorLayout.workspaceLayout);
    expect(selectEditorStageLayout(state)).toBe(editorLayout.editorStageLayout);
    expect(
      JSON.parse(JSON.stringify(workspaceLayoutChanged(editorLayout.workspaceLayout))),
    ).toEqual({
      type: "editorLayout/workspaceLayoutChanged",
      payload: editorLayout.workspaceLayout,
    });
  });
});
