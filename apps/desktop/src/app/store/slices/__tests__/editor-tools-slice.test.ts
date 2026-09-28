import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
  editorToolsReset,
  loopPlaybackToggled,
  segmentPlaybackToggled,
  selectEditorTools,
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import type { RootState } from "@/app/store/store";
describe("editor tools Redux domain", () => {
  it("initializes active tools from supplied Preferences defaults", () => {
    const defaults: Preferences = {
      ...DEFAULT_PREFERENCES,
      loopPlaybackEnabledDefault: false,
    };

    expect(createEditorToolsStateFromPreferences(defaults)).toEqual({
      loopPlaybackEnabled: false,
      segmentPlaybackEnabled: true,
    });
  });

  it("keeps active tools independent from Preference actions", () => {
    const initialState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES)),
    );

    expect(editorToolsReducer(initialState, { type: "preferences/preferenceChanged" })).toEqual(
      initialState,
    );
  });

  it("supports mode toggles", () => {
    const initialState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES)),
    );

    const modeState = editorToolsReducer(
      editorToolsReducer(initialState, loopPlaybackToggled()),
      segmentPlaybackToggled(),
    );

    expect(modeState.loopPlaybackEnabled).toBe(false);
    expect(modeState.segmentPlaybackEnabled).toBe(false);
  });

  it("resets active tools from the supplied current Preferences values", () => {
    const activeState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES)),
    );

    const currentDefaults: Preferences = {
      ...DEFAULT_PREFERENCES,
      loopPlaybackEnabledDefault: false,
    };

    expect(
      editorToolsReducer(
        activeState,
        editorToolsReset(createEditorToolsStateFromPreferences(currentDefaults)),
      ),
    ).toEqual(createEditorToolsStateFromPreferences(currentDefaults));
  });

  it("exposes focused selectors", () => {
    const editorTools = {
      loopPlaybackEnabled: true,
      segmentPlaybackEnabled: false,
    };

    const state = { editorTools } as RootState;

    expect(selectEditorTools(state)).toBe(editorTools);
    expect(selectLoopPlaybackEnabled(state)).toBe(true);
    expect(selectSegmentPlaybackEnabled(state)).toBe(false);
  });
});
