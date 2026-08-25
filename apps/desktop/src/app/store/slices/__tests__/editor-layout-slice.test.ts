import { describe, expect, it } from "vitest";

import type { RootState } from "@/app/store/store";
import {
  createInitialEditorLayoutState,
  editorLayoutReducer,
  editorLayoutReset,
  editorStageLayoutChanged,
  selectEditorLayout,
  selectEditorStageLayout,
  selectShowSourceDetails,
  selectShowTimeline,
  selectWorkspaceLayout,
  sourceDetailsVisibilityChanged,
  timelineVisibilityChanged,
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
      editorLayoutReducer(initialState, sourceDetailsVisibilityChanged(false)),
      timelineVisibilityChanged(false),
    );

    expect(nextState.showSourceDetails).toBe(false);
    expect(nextState.showTimeline).toBe(false);
    expect(nextState.workspaceLayout).toBeUndefined();
    expect(nextState.editorStageLayout).toBeUndefined();
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
    expect(state.showSourceDetails).toBe(true);
    expect(state.showTimeline).toBe(true);
  });

  it("resets the whole layout domain in one operation", () => {
    const changedState = editorLayoutReducer(
      editorLayoutReducer(
        editorLayoutReducer(undefined, sourceDetailsVisibilityChanged(false)),
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
      showSourceDetails: false,
      showTimeline: true,
      workspaceLayout: { "source-details-panel": 20, "editor-content-panel": 80 },
      editorStageLayout: { "preview-panel": 75, "timeline-panel": 25 },
    };
    const state = { editorLayout } as unknown as RootState;

    expect(selectEditorLayout(state)).toBe(editorLayout);
    expect(selectShowSourceDetails(state)).toBe(false);
    expect(selectShowTimeline(state)).toBe(true);
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
