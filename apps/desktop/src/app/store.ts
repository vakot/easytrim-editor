import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import { preferencesReducer, type PreferencesState } from "@/app/preferences-slice";
import {
  definePersistedDomain,
  hydratePersistedDomains,
  observePersistedDomains,
  type PersistedDomain,
} from "@/app/store-persistence";
import { loadToolDefaults, persistToolDefaults } from "@/app/tool-settings";

const rootReducer = combineReducers({
  preferences: preferencesReducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const persistedDomains: readonly PersistedDomain<RootState>[] = [
  definePersistedDomain<RootState, PreferencesState>({
    key: "preferences",
    load: () => ({ toolDefaults: loadToolDefaults() }),
    select: (state) => state.preferences,
    save: (state) => persistToolDefaults(state.toolDefaults),
  }),
];

export function createAppStore(preloadedState?: Partial<RootState>) {
  const appStore = configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...hydratePersistedDomains(persistedDomains),
      ...preloadedState,
    },
  });

  observePersistedDomains(appStore, persistedDomains);
  return appStore;
}

export const store = createAppStore();
export type AppStore = typeof store;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
