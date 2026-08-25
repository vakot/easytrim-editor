import { describe, expect, it } from "vitest";

import { DEFAULT_TOOL_DEFAULTS, type ToolDefaults } from "@/app/tool-settings";
import type { RootState } from "@/app/store/store";
import {
  preferencesReducer,
  selectLoopPlaybackDefault,
  selectMergeAudioDefault,
  selectSafeTrimFollowingDefault,
  selectSegmentPlaybackDefault,
  selectToolDefaults,
  toolDefaultChanged,
  toolDefaultsReset,
} from "@/app/store/slices/preferences-slice";

describe("preferences Redux domain", () => {
  it("starts from deterministic product defaults without persistence access", () => {
    expect(preferencesReducer(undefined, { type: "preferences/initialize" })).toEqual({
      toolDefaults: DEFAULT_TOOL_DEFAULTS,
    });
  });

  it("changes one preference without changing unrelated values", () => {
    const initialState = {
      toolDefaults: { ...DEFAULT_TOOL_DEFAULTS },
    };
    const nextState = preferencesReducer(
      initialState,
      toolDefaultChanged({ key: "safeTrimFollowingEnabled", enabled: false }),
    );

    expect(nextState.toolDefaults.safeTrimFollowingEnabled).toBe(false);
    expect(nextState.toolDefaults.loopPlaybackEnabled).toBe(
      initialState.toolDefaults.loopPlaybackEnabled,
    );
    expect(nextState.toolDefaults.mergeAudioEnabled).toBe(
      initialState.toolDefaults.mergeAudioEnabled,
    );
  });

  it("resets all preferences to product defaults", () => {
    const state = preferencesReducer(
      {
        toolDefaults: {
          safeTrimFollowingEnabled: false,
          loopPlaybackEnabled: false,
          segmentPlaybackEnabled: false,
          mergeAudioEnabled: true,
        },
      },
      toolDefaultsReset(),
    );

    expect(state.toolDefaults).toEqual(DEFAULT_TOOL_DEFAULTS);
  });

  it("selects focused preference values", () => {
    const toolDefaults: ToolDefaults = {
      safeTrimFollowingEnabled: false,
      loopPlaybackEnabled: true,
      segmentPlaybackEnabled: false,
      mergeAudioEnabled: true,
    };
    const state = { preferences: { toolDefaults } } as RootState;

    expect(selectToolDefaults(state)).toEqual(toolDefaults);
    expect(selectSafeTrimFollowingDefault(state)).toBe(false);
    expect(selectLoopPlaybackDefault(state)).toBe(true);
    expect(selectSegmentPlaybackDefault(state)).toBe(false);
    expect(selectMergeAudioDefault(state)).toBe(true);
  });
});
