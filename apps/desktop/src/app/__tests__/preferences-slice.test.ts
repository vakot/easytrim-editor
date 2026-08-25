import { describe, expect, it, afterEach } from "vitest";

import { DEFAULT_TOOL_DEFAULTS, type ToolDefaults } from "@/app/tool-settings";
import { createAppStore, type RootState } from "@/app/store";
import {
  preferencesReducer,
  selectLoopPlaybackDefault,
  selectMergeAudioDefault,
  selectSafeTrimFollowingDefault,
  selectSegmentPlaybackDefault,
  selectToolDefaults,
  toolDefaultChanged,
  toolDefaultsReset,
} from "@/app/preferences-slice";
import { STORAGE_KEYS } from "@/lib/storage";

afterEach(() => localStorage.clear());

describe("preferences Redux domain", () => {
  it("initializes from persisted tool defaults and registers in the store", () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify({ toolDefaults: { loopPlaybackEnabled: false } }),
    );

    const store = createAppStore();

    expect(store.getState().preferences.toolDefaults).toEqual({
      ...DEFAULT_TOOL_DEFAULTS,
      loopPlaybackEnabled: false,
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
