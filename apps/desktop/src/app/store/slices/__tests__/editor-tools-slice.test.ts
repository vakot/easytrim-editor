import { describe, expect, it } from "vitest";

import type { RootState } from "@/app/store/store";
import { DEFAULT_TOOL_DEFAULTS, type ToolDefaults } from "@/app/tool-settings";
import {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
  editorToolsReset,
  loopPlaybackToggled,
  playbackSpeedChanged,
  safeTrimFollowingToggled,
  selectEditorTools,
  selectLoopPlaybackEnabled,
  selectPlaybackSpeed,
  selectSafeTrimFollowingEnabled,
  selectSegmentPlaybackEnabled,
  segmentPlaybackToggled,
} from "@/app/store/slices/editor-tools-slice";
import { DEFAULT_PLAYBACK_SPEED, type PlaybackSpeed } from "@/domain/playback-speed";

describe("editor tools Redux domain", () => {
  it("initializes active tools from supplied Preferences defaults", () => {
    const defaults: ToolDefaults = {
      ...DEFAULT_TOOL_DEFAULTS,
      loopPlaybackEnabled: false,
    };

    expect(createEditorToolsStateFromPreferences(defaults)).toEqual({
      safeTrimFollowingEnabled: true,
      loopPlaybackEnabled: false,
      segmentPlaybackEnabled: true,
      playbackSpeed: DEFAULT_PLAYBACK_SPEED,
    });
  });

  it("changes one active tool without changing unrelated tools", () => {
    const initialState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_TOOL_DEFAULTS)),
    );

    const nextState = editorToolsReducer(initialState, safeTrimFollowingToggled());

    expect(nextState.safeTrimFollowingEnabled).toBe(false);
    expect(nextState.loopPlaybackEnabled).toBe(initialState.loopPlaybackEnabled);
    expect(nextState.segmentPlaybackEnabled).toBe(initialState.segmentPlaybackEnabled);
    expect(nextState.playbackSpeed).toBe(initialState.playbackSpeed);
  });

  it("keeps active tools independent from Preference actions", () => {
    const initialState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_TOOL_DEFAULTS)),
    );

    expect(editorToolsReducer(initialState, { type: "preferences/toolDefaultChanged" })).toEqual(
      initialState,
    );
  });

  it("supports mode toggles and the allowed playback-speed values", () => {
    const initialState = editorToolsReducer(
      undefined,
      editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_TOOL_DEFAULTS)),
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
        editorToolsInitialized(createEditorToolsStateFromPreferences(DEFAULT_TOOL_DEFAULTS)),
      ),
      safeTrimFollowingToggled(),
    );
    const currentDefaults: ToolDefaults = {
      ...DEFAULT_TOOL_DEFAULTS,
      safeTrimFollowingEnabled: false,
      loopPlaybackEnabled: false,
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
      safeTrimFollowingEnabled: false,
      loopPlaybackEnabled: true,
      segmentPlaybackEnabled: false,
      playbackSpeed: 1.5 as PlaybackSpeed,
    };
    const state = { editorTools } as RootState;

    expect(selectEditorTools(state)).toBe(editorTools);
    expect(selectSafeTrimFollowingEnabled(state)).toBe(false);
    expect(selectLoopPlaybackEnabled(state)).toBe(true);
    expect(selectSegmentPlaybackEnabled(state)).toBe(false);
    expect(selectPlaybackSpeed(state)).toBe(1.5);
  });
});
