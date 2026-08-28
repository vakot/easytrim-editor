import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
  editorToolsReset,
  loopPlaybackToggled,
  playbackSpeedChanged,
  segmentPlaybackToggled,
  selectEditorTools,
  selectLoopPlaybackEnabled,
  selectPlaybackSpeed,
  selectSegmentPlaybackEnabled,
  selectSnapPlaybackEnabled,
  snapPlaybackChanged,
  snapPlaybackToggled,
} from "@/app/store/slices/editor-tools-slice";
import type { RootState } from "@/app/store/store";
import { DEFAULT_PLAYBACK_SPEED, type PlaybackSpeed } from "@/domain/playback-speed";

describe("editor tools Redux domain", () => {
  it("initializes active tools from supplied Preferences defaults", () => {
    const defaults: Preferences = {
      ...DEFAULT_PREFERENCES,
      loopPlaybackEnabledDefault: false,
    };

    expect(createEditorToolsStateFromPreferences(defaults)).toEqual({
      snapPlaybackEnabled: true,
      loopPlaybackEnabled: false,
      segmentPlaybackEnabled: true,
      playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    });
  });

  it("changes one active tool without changing unrelated tools", () => {
    const initialState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES)),
    );

    const nextState = editorToolsReducer(initialState, snapPlaybackToggled());

    expect(nextState.snapPlaybackEnabled).toBe(false);
    expect(nextState.loopPlaybackEnabled).toBe(initialState.loopPlaybackEnabled);
    expect(nextState.segmentPlaybackEnabled).toBe(initialState.segmentPlaybackEnabled);
    expect(nextState.playbackSpeed).toBe(initialState.playbackSpeed);
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

  it("supports explicitly changing snap playback", () => {
    const initialState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES)),
    );

    const nextState = editorToolsReducer(initialState, snapPlaybackChanged(false));

    expect(nextState.snapPlaybackEnabled).toBe(false);
    expect(nextState.loopPlaybackEnabled).toBe(initialState.loopPlaybackEnabled);
    expect(nextState.segmentPlaybackEnabled).toBe(initialState.segmentPlaybackEnabled);
    expect(nextState.playbackSpeed).toBe(initialState.playbackSpeed);
  });

  it("supports mode toggles and the allowed playback-speed values", () => {
    const initialState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES)),
    );

    const modeState = editorToolsReducer(
      editorToolsReducer(initialState, loopPlaybackToggled()),
      segmentPlaybackToggled(),
    );

    const speed: PlaybackSpeed = 2;

    expect(modeState.loopPlaybackEnabled).toBe(false);
    expect(modeState.segmentPlaybackEnabled).toBe(false);
    expect(editorToolsReducer(modeState, playbackSpeedChanged(speed)).playbackSpeed).toBe(speed);
  });

  it("resets active tools from the supplied current Preferences values", () => {
    const activeState = editorToolsReducer(
      editorToolsReducer(
        undefined,
        editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES)),
      ),
      snapPlaybackToggled(),
    );

    const currentDefaults: Preferences = {
      ...DEFAULT_PREFERENCES,
      snapPlaybackEnabledDefault: false,
      loopPlaybackEnabledDefault: false,
    };

    expect(
      editorToolsReducer(
        editorToolsReducer(activeState, playbackSpeedChanged(3)),
        editorToolsReset(createEditorToolsStateFromPreferences(currentDefaults)),
      ),
    ).toEqual(createEditorToolsStateFromPreferences(currentDefaults));
  });

  it("exposes focused selectors", () => {
    const editorTools = {
      snapPlaybackEnabled: false,
      loopPlaybackEnabled: true,
      segmentPlaybackEnabled: false,
      playbackSpeed: 1.5 as PlaybackSpeed,
    };

    const state = { editorTools } as RootState;

    expect(selectEditorTools(state)).toBe(editorTools);
    expect(selectSnapPlaybackEnabled(state)).toBe(false);
    expect(selectLoopPlaybackEnabled(state)).toBe(true);
    expect(selectSegmentPlaybackEnabled(state)).toBe(false);
    expect(selectPlaybackSpeed(state)).toBe(1.5);
  });
});
