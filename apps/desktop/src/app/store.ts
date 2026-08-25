import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
  type PersistConfig,
  type Persistor,
  type Storage as PersistStorage,
} from "redux-persist";
import reduxStorageModule from "redux-persist/lib/storage";

import { preferencesReducer } from "@/app/preferences-slice";

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
const reduxStorage = resolveReduxPersistStorage(reduxStorageModule);

const rootReducer = combineReducers({
  preferences: preferencesReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const persistConfig: PersistConfig<RootState> = {
  key: "easytrim-redux",
  storage: reduxStorage,
  // NOTE: Root allow-listing keeps future reducers runtime-only until explicitly opted in.
  whitelist: ["preferences"],
};

export const persistedReducer = persistReducer(persistConfig, rootReducer);

export function createAppStore(storage: PersistStorage = reduxStorage) {
  const reducer =
    storage === reduxStorage
      ? persistedReducer
      : persistReducer({ ...persistConfig, storage }, rootReducer);

  return configureStore({
    reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];

export function createAppPersistor(appStore: AppStore): Persistor {
  return persistStore(appStore);
}

export const store = createAppStore();
export const persistor = createAppPersistor(store);

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
