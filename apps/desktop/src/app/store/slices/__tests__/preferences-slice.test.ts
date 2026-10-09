import { describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import {
  activityFeedViewChanged,
  changelogVersionSeen,
  editingSettingsReset,
  layoutDensityChanged,
  layoutReset,
  preferenceChanged,
  preferencesReducer,
  primaryColorChanged,
  selectActivityFeedView,
  selectDeleteSourceOnRenderFinish,
  selectLayoutDensity,
  selectMergeAudioEnabledDefault,
  selectPreferences,
  selectPrimaryColor,
  selectStripMetadataOnExport,
  selectThemePreference,
  themePreferenceChanged,
  uiScalingReset,
} from "@/app/store/slices/preferences-slice";
import type { RootState } from "@/app/store/store";
import { isHexColor } from "@/lib/color.utils";

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
      preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }),
    );

    expect(nextState.loopPlaybackEnabledDefault).toBe(false);
    expect(nextState.mergeAudioEnabledDefault).toBe(initialState.mergeAudioEnabledDefault);
  });

  it("changes the activity feed view without changing unrelated preferences", () => {
    const nextState = preferencesReducer(undefined, activityFeedViewChanged("compact"));

    expect(nextState.activityFeedView).toBe("compact");
    expect(nextState.loopPlaybackEnabledDefault).toBe(
      DEFAULT_PREFERENCES.loopPlaybackEnabledDefault,
    );
  });

  it("persists the changelog seen marker without resetting it with preferences", () => {
    const seenState = preferencesReducer(undefined, changelogVersionSeen("1.10.4"));
    const resetState = preferencesReducer(seenState, editingSettingsReset());

    expect(seenState.lastSeenChangelogVersion).toBe("1.10.4");
    expect(resetState.lastSeenChangelogVersion).toBe("1.10.4");
  });

  it("supports the persisted branch activity feed view", () => {
    const nextState = preferencesReducer(undefined, activityFeedViewChanged("branch"));

    expect(nextState.activityFeedView).toBe("branch");
    expect(selectActivityFeedView({ preferences: nextState } as RootState)).toBe("branch");
  });

  it("changes and selects the layout density", () => {
    const nextState = preferencesReducer(undefined, layoutDensityChanged("compact"));

    expect(selectLayoutDensity({ preferences: nextState } as RootState)).toBe("compact");
  });

  it("stores preset and custom colors in the single primary color preference", () => {
    const themedState = preferencesReducer(undefined, themePreferenceChanged("dark"));
    const presetState = preferencesReducer(themedState, primaryColorChanged("#4299e1"));
    const customState = preferencesReducer(presetState, primaryColorChanged("#123456"));

    expect(themedState.theme).toBe("dark");
    expect(presetState.primaryColor).toBe("#4299e1");
    expect(customState.primaryColor).toBe("#123456");
    expect(isHexColor(customState.primaryColor)).toBe(true);
    expect(customState).not.toHaveProperty("customPrimaryColor");
  });

  it("resets only Editing settings while preserving settings owned by other sections", () => {
    const state = preferencesReducer(
      {
        loopPlaybackEnabledDefault: false,
        segmentPlaybackEnabledDefault: false,
        autoStartQueueEnabled: false,
        mergeAudioEnabledDefault: true,
        stripMetadataOnExport: true,
        deleteSourceOnRenderFinish: true,
        lastSeenChangelogVersion: null,
        activityFeedView: "branch",
        layoutDensity: "compact",
        theme: "dark",
        primaryColor: "#123456",
        lastAudiblePlaybackVolumePercent: 100,
        playbackVolumePercent: 100,
        uiScalePercent: 125,
      },
      editingSettingsReset(),
    );

    expect(state).toEqual({
      ...DEFAULT_PREFERENCES,
      activityFeedView: "branch",
      layoutDensity: "compact",
      theme: "dark",
      primaryColor: "#123456",
      autoStartQueueEnabled: false,
      deleteSourceOnRenderFinish: true,
      uiScalePercent: 125,
    });
  });

  it("resets activity feed view and layout density without changing other preferences", () => {
    const initialState: Preferences = {
      ...DEFAULT_PREFERENCES,
      activityFeedView: "branch",
      layoutDensity: "compact",
      loopPlaybackEnabledDefault: false,
      segmentPlaybackEnabledDefault: false,
      mergeAudioEnabledDefault: true,
      stripMetadataOnExport: true,
      autoStartQueueEnabled: false,
      deleteSourceOnRenderFinish: true,
      theme: "dark",
      primaryColor: "#123456",
      uiScalePercent: 125,
    };

    const state = preferencesReducer(initialState, layoutReset());

    expect(state).toEqual({
      ...initialState,
      activityFeedView: DEFAULT_PREFERENCES.activityFeedView,
      layoutDensity: DEFAULT_PREFERENCES.layoutDensity,
    });
  });

  it("resets only UI scaling while preserving theme and primary color", () => {
    const initialState: Preferences = {
      ...DEFAULT_PREFERENCES,
      uiScalePercent: 150,
      theme: "dark",
      primaryColor: "#123456",
    };

    const state = preferencesReducer(initialState, uiScalingReset());

    expect(state).toEqual({
      ...initialState,
      uiScalePercent: DEFAULT_PREFERENCES.uiScalePercent,
    });
  });

  it("selects focused preference values", () => {
    const preferences: Preferences = {
      loopPlaybackEnabledDefault: true,
      segmentPlaybackEnabledDefault: false,
      autoStartQueueEnabled: true,
      mergeAudioEnabledDefault: true,
      stripMetadataOnExport: true,
      deleteSourceOnRenderFinish: false,
      lastSeenChangelogVersion: null,
      activityFeedView: "default",
      layoutDensity: "default",
      theme: "system",
      primaryColor: "#efbf04",
      lastAudiblePlaybackVolumePercent: 100,
      playbackVolumePercent: 100,
      uiScalePercent: 100,
    };

    const state = { preferences } as RootState;

    expect(selectPreferences(state)).toEqual(preferences);
    expect(selectPreferences(state).loopPlaybackEnabledDefault).toBe(true);
    expect(selectPreferences(state).segmentPlaybackEnabledDefault).toBe(false);
    expect(selectMergeAudioEnabledDefault(state)).toBe(true);
    expect(selectStripMetadataOnExport(state)).toBe(true);
    expect(selectDeleteSourceOnRenderFinish(state)).toBe(false);
    expect(selectActivityFeedView(state)).toBe("default");
    expect(selectThemePreference(state)).toBe("system");
    expect(selectPrimaryColor(state)).toBe("#efbf04");
  });

  it("falls back to the default activity feed view for invalid persisted state", () => {
    const state = {
      preferences: { ...DEFAULT_PREFERENCES, activityFeedView: "expanded" },
    } as unknown as RootState;

    expect(selectActivityFeedView(state)).toBe("default");
  });
});
