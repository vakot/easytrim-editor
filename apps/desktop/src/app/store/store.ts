import { configureStore } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  type Persistor,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from "redux-persist";

import { appMiddleware } from "@/app/store/middleware";
import { createPersistedReducer, type PersistStorage, reduxStorage } from "@/app/store/persistence";

import { workspaceReducer } from "./reducer";

export type { RootState } from "./reducer";

const persistedReducer = createPersistedReducer(workspaceReducer);

function createAppStore(storage: PersistStorage = reduxStorage) {
  const reducer =
    storage === reduxStorage ? persistedReducer : createPersistedReducer(workspaceReducer, storage);

  return configureStore({
    reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      })
        .prepend(...appMiddleware.prepend)
        .concat(...appMiddleware.append),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore["dispatch"];

function createAppPersistor(appStore: AppStore): Persistor {
  return persistStore(appStore);
}

export const store = createAppStore();
export const persistor = createAppPersistor(store);

export { createAppPersistor, createAppStore };
