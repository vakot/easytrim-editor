import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import {
  audioActivityDetectionFinished,
  audioActivityMarkersToggled,
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
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

  it("stores audio activity ranges and supports hiding their timeline markers", () => {
    const ranges = [{ startMicros: 1_000_000, endMicros: 2_000_000 }];
    const detected = editorToolsReducer(
      undefined,
      audioActivityDetectionFinished({ mixKey: "mix", ranges, sourceKey: "source" }),
    );

    const hidden = editorToolsReducer(detected, audioActivityMarkersToggled());

    expect(detected.audioActivityDetection).toMatchObject({
      mixKey: "mix",
      ranges,
      sourceKey: "source",
      status: "ready",
    });
    expect(hidden.audioActivityMarkersEnabled).toBe(false);
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
