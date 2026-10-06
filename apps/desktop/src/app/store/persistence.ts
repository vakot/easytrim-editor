import type { Reducer } from "@reduxjs/toolkit";
import {
  createMigrate,
  createTransform,
  type PersistConfig,
  type PersistedState,
  persistReducer,
  type PersistState,
  type Storage as PersistStorage,
} from "redux-persist";
import reduxStorageModule from "redux-persist/lib/storage";

import { isLayoutDensity } from "@/app/layout/lib/layout-density";
import {
  DEFAULT_PLAYBACK_VOLUME_PERCENT,
  DEFAULT_PREFERENCES,
  MAX_UI_SCALE_PERCENT,
  MIN_UI_SCALE_PERCENT,
  type Preferences,
  UI_SCALE_STEP_PERCENT,
} from "@/app/preferences";
import { isThemePreference } from "@/app/theme/theme";
import type { HexColor } from "@/lib/color.types";
import { isHexColor } from "@/lib/color.utils";

interface LegacyThemeState {
  customPrimaryColor?: unknown;
  preference?: unknown;
  primaryColor?: unknown;
}

const legacyPrimaryColorValues: Record<string, HexColor> = {
  amber: "#efbf04",
  rose: "#e85d75",
  violet: "#8b6ee8",
  blue: "#4299e1",
  emerald: "#32a876",
};

function migratePrimaryColor(value: unknown, legacyCustomColor?: unknown): HexColor {
  if (isHexColor(String(value ?? ""))) {
    return String(value) as HexColor;
  }
  if (typeof value === "string" && Object.hasOwn(legacyPrimaryColorValues, value)) {
    return legacyPrimaryColorValues[value]!;
  }
  if ((value === "custom" || value == null) && isHexColor(String(legacyCustomColor ?? ""))) {
    return String(legacyCustomColor) as HexColor;
  }
  return DEFAULT_PREFERENCES.primaryColor;
}

interface PersistedRootState {
  [key: string]: unknown;
  _persist?: PersistState;
  preferences?: Partial<Preferences>;
  theme?: LegacyThemeState;
}

function hasPersistStorageMethods(value: unknown): value is PersistStorage {
  return (
    typeof value === "object" &&
    value !== null &&
    "getItem" in value &&
    typeof value.getItem === "function" &&
    "setItem" in value &&
    typeof value.setItem === "function" &&
    "removeItem" in value &&
    typeof value.removeItem === "function"
  );
}

function resolveReduxPersistStorage(value: unknown): PersistStorage {
  if (hasPersistStorageMethods(value)) {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "default" in value &&
    hasPersistStorageMethods(value.default)
  ) {
    return value.default;
  }

  throw new TypeError("Redux Persist storage must implement getItem, setItem, and removeItem");
}

// NOTE: Vite 8 unwraps redux-persist's CommonJS subpath differently from Vitest.
export const reduxStorage = resolveReduxPersistStorage(reduxStorageModule);

const preferencesTransform = createTransform(
  (state: unknown) => state,
  (state: unknown): Preferences => {
    if (typeof state !== "object" || state === null || Array.isArray(state)) {
      return DEFAULT_PREFERENCES;
    }

    const persistedPreferences = Object.fromEntries(
      Object.entries(state).filter(
        ([key]) =>
          key !== "editorSourceCollapsibleState" &&
          key !== "snapPlaybackEnabledDefault" &&
          key !== "customPrimaryColor",
      ),
    ) as Partial<Preferences>;

    const playbackVolumePercent =
      typeof persistedPreferences.playbackVolumePercent === "number" &&
      Number.isFinite(persistedPreferences.playbackVolumePercent)
        ? Math.max(0, Math.min(100, persistedPreferences.playbackVolumePercent))
        : DEFAULT_PLAYBACK_VOLUME_PERCENT;

    const lastAudiblePlaybackVolumePercent =
      typeof persistedPreferences.lastAudiblePlaybackVolumePercent === "number" &&
      Number.isFinite(persistedPreferences.lastAudiblePlaybackVolumePercent) &&
      persistedPreferences.lastAudiblePlaybackVolumePercent > 0
        ? Math.min(100, persistedPreferences.lastAudiblePlaybackVolumePercent)
        : playbackVolumePercent || DEFAULT_PLAYBACK_VOLUME_PERCENT;

    return {
      ...DEFAULT_PREFERENCES,
      ...persistedPreferences,
      activityFeedView:
        persistedPreferences.activityFeedView === "compact" ||
        persistedPreferences.activityFeedView === "branch"
          ? persistedPreferences.activityFeedView
          : "default",
      layoutDensity: isLayoutDensity(persistedPreferences.layoutDensity)
        ? persistedPreferences.layoutDensity
        : DEFAULT_PREFERENCES.layoutDensity,
      uiScalePercent:
        typeof persistedPreferences.uiScalePercent === "number" &&
        Number.isFinite(persistedPreferences.uiScalePercent) &&
        persistedPreferences.uiScalePercent >= MIN_UI_SCALE_PERCENT &&
        persistedPreferences.uiScalePercent <= MAX_UI_SCALE_PERCENT &&
        (persistedPreferences.uiScalePercent - MIN_UI_SCALE_PERCENT) % UI_SCALE_STEP_PERCENT === 0
          ? persistedPreferences.uiScalePercent
          : DEFAULT_PREFERENCES.uiScalePercent,
      lastAudiblePlaybackVolumePercent,
      playbackVolumePercent,
      primaryColor: migratePrimaryColor(
        (state as Record<string, unknown>).primaryColor,
        (state as Record<string, unknown>).customPrimaryColor,
      ),
      theme: isThemePreference(persistedPreferences.theme)
        ? persistedPreferences.theme
        : DEFAULT_PREFERENCES.theme,
    };
  },
  { whitelist: ["preferences"] },
);

const migrateLegacyTheme = (state: PersistedState): PersistedState => {
  if (!state || typeof state !== "object") {
    return state;
  }

  const persistedState = state as PersistedRootState;
  const legacyTheme = persistedState.theme;
  const preferences = {
    ...DEFAULT_PREFERENCES,
    ...(persistedState.preferences ?? {}),
  };

  if (isThemePreference(legacyTheme?.preference)) {
    preferences.theme = legacyTheme.preference;
  }
  if (legacyTheme?.primaryColor !== undefined) {
    preferences.primaryColor = legacyTheme.primaryColor as Preferences["primaryColor"];
  }
  if (legacyTheme?.customPrimaryColor !== undefined) {
    (preferences as Preferences & { customPrimaryColor?: unknown }).customPrimaryColor =
      legacyTheme.customPrimaryColor;
    if (legacyTheme.primaryColor === undefined) {
      preferences.primaryColor = "custom" as Preferences["primaryColor"];
    }
  }

  const stateWithoutTheme = { ...persistedState };
  delete stateWithoutTheme.theme;
  return { ...stateWithoutTheme, preferences } as PersistedState;
};

const migratePrimaryColorPreference = (state: PersistedState): PersistedState => {
  if (!state || typeof state !== "object") {
    return state;
  }

  const persistedState = state as PersistedRootState;
  const legacyPreferences = (persistedState.preferences ?? {}) as Preferences & {
    customPrimaryColor?: unknown;
  };

  const { customPrimaryColor, ...preferences } = legacyPreferences;

  return {
    ...persistedState,
    preferences: {
      ...preferences,
      primaryColor: migratePrimaryColor(preferences.primaryColor, customPrimaryColor),
    },
  } as PersistedState;
};

const migrations = createMigrate({ 1: migrateLegacyTheme, 2: migratePrimaryColorPreference });

export const persistConfig: PersistConfig<unknown> = {
  key: "easytrim-redux",
  storage: reduxStorage,
  version: 2,
  migrate: migrations,
  // NOTE: Root allow-listing keeps future reducers runtime-only until explicitly opted in.
  transforms: [preferencesTransform],
  whitelist: ["preferences"],
};

function createPersistedReducer<RootState>(
  rootReducer: Reducer<RootState>,
  storage: PersistStorage = reduxStorage,
): Reducer<RootState & { _persist: PersistState }> {
  return persistReducer({ ...persistConfig, storage } as PersistConfig<RootState>, rootReducer);
}

export { createPersistedReducer, resolveReduxPersistStorage };

export type { PersistStorage };
