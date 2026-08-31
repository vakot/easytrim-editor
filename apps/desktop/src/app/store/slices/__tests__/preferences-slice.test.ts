import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import {
  activityFeedViewChanged,
  preferenceChanged,
  preferencesReducer,
  preferencesReset,
  selectActivityFeedView,
  selectDeleteSourceOnRenderFinish,
  selectMergeAudioEnabledDefault,
  selectPreferences,
} from "@/app/store/slices/preferences-slice";
import type { RootState } from "@/app/store/store";

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

  it("changes the activity feed view without changing unrelated preferences", () => {
    const nextState = preferencesReducer(undefined, activityFeedViewChanged("compact"));

    expect(nextState.activityFeedView).toBe("compact");
    expect(nextState.loopPlaybackEnabledDefault).toBe(
      DEFAULT_PREFERENCES.loopPlaybackEnabledDefault,
    );
  });

  it("resets all preferences to product defaults", () => {
    const state = preferencesReducer(
      {
        snapPlaybackEnabledDefault: false,
        loopPlaybackEnabledDefault: false,
        segmentPlaybackEnabledDefault: false,
        autoStartQueueEnabled: false,
        mergeAudioEnabledDefault: true,
        deleteSourceOnRenderFinish: false,
        activityFeedView: "default",
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
      deleteSourceOnRenderFinish: false,
      activityFeedView: "default",
    };

    const state = { preferences } as RootState;

    expect(selectPreferences(state)).toEqual(preferences);
    expect(selectPreferences(state).snapPlaybackEnabledDefault).toBe(false);
    expect(selectPreferences(state).loopPlaybackEnabledDefault).toBe(true);
    expect(selectPreferences(state).segmentPlaybackEnabledDefault).toBe(false);
    expect(selectMergeAudioEnabledDefault(state)).toBe(true);
    expect(selectDeleteSourceOnRenderFinish(state)).toBe(false);
    expect(selectActivityFeedView(state)).toBe("default");
  });

  it("falls back to the default activity feed view for invalid persisted state", () => {
    const state = {
      preferences: { ...DEFAULT_PREFERENCES, activityFeedView: "expanded" },
    } as unknown as RootState;

    expect(selectActivityFeedView(state)).toBe("default");
  });
});
