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
import reduxStorage from "redux-persist/lib/storage";

import { preferencesReducer } from "@/app/preferences-slice";

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
