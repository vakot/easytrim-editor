import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import type { RootState } from "@/app/store/store";
import {
  preferencesReducer,
  preferenceChanged,
  preferencesReset,
  selectLoopPlaybackEnabledDefault,
  selectMergeAudioEnabledDefault,
  selectPreferences,
  selectSnapPlaybackEnabledDefault,
  selectSegmentPlaybackEnabledDefault,
} from "@/app/store/slices/preferences-slice";

describe("preferences Redux domain", () => {
  it("starts from deterministic product defaults without persistence access", () => {
    expect(preferencesReducer(undefined, { type: "preferences/initialize" })).toEqual({
      ...DEFAULT_PREFERENCES,
    });
  });

  it("changes one preference without changing unrelated values", () => {
    const initialState = {
      ...DEFAULT_PREFERENCES,
    };
    const nextState = preferencesReducer(
      initialState,
      preferenceChanged({ key: "snapPlaybackEnabledDefault", enabled: false }),
    );

    expect(nextState.snapPlaybackEnabledDefault).toBe(false);
    expect(nextState.loopPlaybackEnabledDefault).toBe(initialState.loopPlaybackEnabledDefault);
    expect(nextState.mergeAudioEnabledDefault).toBe(initialState.mergeAudioEnabledDefault);
  });

  it("resets all preferences to product defaults", () => {
    const state = preferencesReducer(
      {
        snapPlaybackEnabledDefault: false,
        loopPlaybackEnabledDefault: false,
        segmentPlaybackEnabledDefault: false,
        autoStartQueueEnabled: false,
        mergeAudioEnabledDefault: true,
      },
      preferencesReset(),
    );

    expect(state).toEqual(DEFAULT_PREFERENCES);
  });

  it("selects focused preference values", () => {
    const preferences: Preferences = {
      snapPlaybackEnabledDefault: false,
      loopPlaybackEnabledDefault: true,
      segmentPlaybackEnabledDefault: false,
      autoStartQueueEnabled: true,
      mergeAudioEnabledDefault: true,
    };
    const state = { preferences } as RootState;

    expect(selectPreferences(state)).toEqual(preferences);
    expect(selectSnapPlaybackEnabledDefault(state)).toBe(false);
    expect(selectLoopPlaybackEnabledDefault(state)).toBe(true);
    expect(selectSegmentPlaybackEnabledDefault(state)).toBe(false);
    expect(selectMergeAudioEnabledDefault(state)).toBe(true);
  });
});
