import { combineReducers, configureStore, type Middleware } from "@reduxjs/toolkit";
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
import { audioReducer } from "@/app/store/slices/audio-slice";
import { cropReducer } from "@/app/store/slices/crop-slice";
import { exportPresetsReducer } from "@/app/store/slices/export-presets-slice";
import { exportReducer } from "@/app/store/slices/export-slice";
import { importWorkflowReducer } from "@/app/store/slices/import-workflow-slice";
import {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
} from "@/app/store/slices/editor-tools-slice";
import { preferencesReducer } from "@/app/store/slices/preferences-slice";
import { previewReducer } from "@/app/store/slices/preview-slice";
import { sourceReducer } from "@/app/store/slices/source-slice";
import { themeReducer } from "@/app/store/slices/theme-slice";
import { trimReducer } from "@/app/store/slices/trim-slice";
import { persistExportPresetState } from "@/features/export/export-presets";

const rootReducer = combineReducers({
  audio: audioReducer,
  crop: cropReducer,
  editorLayout: editorLayoutReducer,
  editorTools: editorToolsReducer,
  export: exportReducer,
  exportPresets: exportPresetsReducer,
  importWorkflow: importWorkflowReducer,
  preferences: preferencesReducer,
  preview: previewReducer,
  source: sourceReducer,
  theme: themeReducer,
  trim: trimReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

const exportPresetPersistenceMiddleware: Middleware<unknown, RootState> =
  ({ getState }) =>
  (next) =>
  (action) => {
    const result = next(action);
    if (
      typeof action === "object" &&
      action !== null &&
      "type" in action &&
      typeof action.type === "string" &&
      action.type.startsWith("exportPresets/")
    ) {
      persistExportPresetState(getState().exportPresets);
    }
    return result;
  };

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
      }).concat(exportPresetPersistenceMiddleware),
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
