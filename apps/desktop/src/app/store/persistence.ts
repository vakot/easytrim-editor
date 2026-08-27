import type { Reducer } from "@reduxjs/toolkit";
import {
  persistReducer,
  type PersistConfig,
  type PersistState,
  type Storage as PersistStorage,
} from "redux-persist";
import reduxStorageModule from "redux-persist/lib/storage";

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

export const persistConfig: PersistConfig<unknown> = {
  key: "easytrim-redux",
  storage: reduxStorage,
  // NOTE: Root allow-listing keeps future reducers runtime-only until explicitly opted in.
  whitelist: ["panelLayout", "preferences", "theme"],
};

export function createPersistedReducer<RootState>(
  rootReducer: Reducer<RootState>,
  storage: PersistStorage = reduxStorage,
): Reducer<RootState & { _persist: PersistState }> {
  return persistReducer({ ...persistConfig, storage } as PersistConfig<RootState>, rootReducer);
}

export type { PersistStorage };
