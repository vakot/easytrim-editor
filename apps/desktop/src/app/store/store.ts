import { combineReducers, configureStore, type UnknownAction } from "@reduxjs/toolkit";
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

import { sourceFailed, sourceReady } from "@/app/store/actions/source-actions";
import { appMiddleware } from "@/app/store/middleware";
import { createPersistedReducer, type PersistStorage, reduxStorage } from "@/app/store/persistence";
import { audioReducer } from "@/app/store/slices/audio-slice";
import { cropReducer } from "@/app/store/slices/crop-slice";
import {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
} from "@/app/store/slices/editor-tools-slice";
import { exportPresetsReducer } from "@/app/store/slices/export-presets-slice";
import { exportReducer } from "@/app/store/slices/export-slice";
import { importWorkflowReducer } from "@/app/store/slices/import-workflow-slice";
import { preferencesReducer } from "@/app/store/slices/preferences-slice";
import { previewReducer } from "@/app/store/slices/preview-slice";
import { sourceReducer } from "@/app/store/slices/source-slice";
import { trimReducer } from "@/app/store/slices/trim-slice";

const combinedReducer = combineReducers({
  audio: audioReducer,
  crop: cropReducer,
  editorTools: editorToolsReducer,
  export: exportReducer,
  exportPresets: exportPresetsReducer,
  importWorkflow: importWorkflowReducer,
  preferences: preferencesReducer,
  preview: previewReducer,
  source: sourceReducer,
  trim: trimReducer,
});

export type RootState = ReturnType<typeof combinedReducer>;

const rootReducer = (state: RootState | undefined, action: UnknownAction): RootState => {
  if (state && sourceReady.match(action) && state.source.loadToken !== action.payload.loadToken) {
    return state;
  }
  if (
    state &&
    sourceFailed.match(action) &&
    action.payload.loadToken !== undefined &&
    state.source.loadToken !== action.payload.loadToken
  ) {
    return state;
  }
  return combinedReducer(state, action);
};

const persistedReducer = createPersistedReducer(rootReducer);

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
      })
        .prepend(...appMiddleware.prepend)
        .concat(...appMiddleware.append),
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
        createEditorToolsStateFromPreferences(appStore.getState().preferences),
      ),
    );
  });
}

export const store = createAppStore();
export const persistor = createAppPersistor(store);
