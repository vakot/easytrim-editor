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

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import { isCustomPrimaryColor, isPrimaryColor, isThemePreference } from "@/app/theme/theme";

interface LegacyThemeState {
  customPrimaryColor?: unknown;
  preference?: unknown;
  primaryColor?: unknown;
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

export function resolveReduxPersistStorage(value: unknown): PersistStorage {
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

    const persistedPreferences = state as Partial<Preferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...persistedPreferences,
      activityFeedView: persistedPreferences.activityFeedView === "compact" ? "compact" : "default",
      customPrimaryColor: isCustomPrimaryColor(persistedPreferences.customPrimaryColor)
        ? persistedPreferences.customPrimaryColor
        : DEFAULT_PREFERENCES.customPrimaryColor,
      primaryColor: isPrimaryColor(persistedPreferences.primaryColor)
        ? persistedPreferences.primaryColor
        : DEFAULT_PREFERENCES.primaryColor,
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
  if (isPrimaryColor(legacyTheme?.primaryColor)) {
    preferences.primaryColor = legacyTheme.primaryColor;
  }
  if (isCustomPrimaryColor(legacyTheme?.customPrimaryColor)) {
    preferences.customPrimaryColor = legacyTheme.customPrimaryColor;
  }

  const stateWithoutTheme = { ...persistedState };
  delete stateWithoutTheme.theme;
  return { ...stateWithoutTheme, preferences } as PersistedState;
};

const migrations = createMigrate({ 1: migrateLegacyTheme });

export const persistConfig: PersistConfig<unknown> = {
  key: "easytrim-redux",
  storage: reduxStorage,
  version: 1,
  migrate: migrations,
  // NOTE: Root allow-listing keeps future reducers runtime-only until explicitly opted in.
  transforms: [preferencesTransform],
  whitelist: ["preferences"],
};

export function createPersistedReducer<RootState>(
  rootReducer: Reducer<RootState>,
  storage: PersistStorage = reduxStorage,
): Reducer<RootState & { _persist: PersistState }> {
  return persistReducer({ ...persistConfig, storage } as PersistConfig<RootState>, rootReducer);
}

export type { PersistStorage };
