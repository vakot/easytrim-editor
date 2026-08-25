import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
  type Persistor,
} from "redux-persist";

import { createPersistedReducer, reduxStorage, type PersistStorage } from "@/app/store/persistence";
import { editorLayoutReducer } from "@/app/store/slices/editor-layout-slice";
import {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
} from "@/app/store/slices/editor-tools-slice";
import { preferencesReducer } from "@/app/store/slices/preferences-slice";
import { sessionReducer } from "@/app/store/slices/session-slice";

const rootReducer = combineReducers({
  editorLayout: editorLayoutReducer,
  editorTools: editorToolsReducer,
  preferences: preferencesReducer,
  session: sessionReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const persistedReducer = createPersistedReducer(rootReducer);

export function createAppStore(storage: PersistStorage = reduxStorage) {
  const reducer =
    storage === reduxStorage ? persistedReducer : createPersistedReducer(rootReducer, storage);

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
  return persistStore(appStore, undefined, () => {
    // Redux Persist invokes this only after Preferences has been rehydrated. The
    // one-time initialization keeps active tools independent from later preference edits.
    appStore.dispatch(
      editorToolsInitialized(
        createEditorToolsStateFromPreferences(appStore.getState().preferences.toolDefaults),
      ),
    );
  });
}

export const store = createAppStore();
export const persistor = createAppPersistor(store);
