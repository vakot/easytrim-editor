import type { Persistor, Storage as PersistStorage } from "redux-persist";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { queueSettingsReset } from "@/app/store/actions/queue-actions";
import { persistConfig, resolveReduxPersistStorage } from "@/app/store/persistence";
import {
  optimizedExportDialogOpened,
  queueFinishActionChanged,
} from "@/app/store/slices/export-slice";
import { playbackSpeedChanged } from "@/app/store/slices/playback-controls-slice";
import {
  activityFeedViewChanged,
  editingSettingsReset,
  layoutDensityChanged,
  preferenceChanged,
  primaryColorChanged,
  themePreferenceChanged,
  uiScaleIncreased,
} from "@/app/store/slices/preferences-slice";
import { type AppStore, createAppPersistor, createAppStore } from "@/app/store/store";

interface TestStorage extends PersistStorage {
  values: Map<string, string>;
}

const activePersistors: Persistor[] = [];

afterEach(() => {
  for (const persistor of activePersistors) {
    persistor.pause();
  }
  activePersistors.length = 0;
});

function createTestStorage(initialValues: Record<string, string> = {}): TestStorage {
  const values = new Map(Object.entries(initialValues));

  return {
    values,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}

async function waitForRehydration(persistor: Persistor): Promise<void> {
  if (persistor.getState().bootstrapped) {
    return;
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = persistor.subscribe(() => {
      if (persistor.getState().bootstrapped) {
        unsubscribe();
        resolve();
      }
    });
  });
}

async function createPersistedTestStore(
  storage = createTestStorage(),
): Promise<{ persistor: Persistor; storage: TestStorage; store: AppStore }> {
  const store = createAppStore(storage);
  const persistor = createAppPersistor(store);
  activePersistors.push(persistor);
  await waitForRehydration(persistor);
  return { store, persistor, storage };
}

async function readPersistedRoot(storage: TestStorage): Promise<Record<string, unknown>> {
  const raw = storage.values.get(`persist:${persistConfig.key}`);
  return raw ? JSON.parse(raw) : {};
}

describe("Redux Persist store integration", () => {
  it("normalizes the Vite CommonJS interop shape to a WebStorage adapter", () => {
    const storage = createTestStorage();

    expect(resolveReduxPersistStorage(storage)).toBe(storage);
    expect(resolveReduxPersistStorage({ default: storage })).toBe(storage);
    expect(() => resolveReduxPersistStorage({ default: {} })).toThrow(TypeError);
    expect(typeof persistConfig.storage.getItem).toBe("function");
    expect(typeof persistConfig.storage.setItem).toBe("function");
    expect(typeof persistConfig.storage.removeItem).toBe("function");
  });

  it("keeps Preferences defaults deterministic before rehydration", () => {
    const storage = createTestStorage();
    const store = createAppStore(storage);

    expect(store.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(storage.values).toEqual(new Map());
  });

  it("configures Preferences as the persisted application domain", () => {
    expect(persistConfig.whitelist).toEqual(["preferences"]);
    expect(persistConfig.whitelist).not.toContain("activityFeedView");
    expect(persistConfig.whitelist).not.toContain("editorTools");
    expect(persistConfig.whitelist).not.toContain("importWorkflow");
    expect(persistConfig.whitelist).not.toContain("source");
    expect(persistConfig.whitelist).not.toContain("trim");
    expect(persistConfig.whitelist).not.toContain("crop");
    expect(persistConfig.whitelist).not.toContain("audio");
    expect(persistConfig.whitelist).not.toContain("preview");
    expect(persistConfig.whitelist).not.toContain("export");
    expect(persistConfig.whitelist).not.toContain("exportPresets");
  });

  it("rehydrates Preferences through redux-persist", async () => {
    const storage = createTestStorage({
      [`persist:${persistConfig.key}`]: JSON.stringify({
        preferences: JSON.stringify({
          ...DEFAULT_PREFERENCES,
          loopPlaybackEnabledDefault: false,
          activityFeedView: "compact",
        }),
        theme: JSON.stringify({
          preference: "dark",
          primaryColor: "#123456",
        }),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    });

    const { persistor, store } = await createPersistedTestStore(storage);

    expect(store.getState().preferences).toEqual({
      ...DEFAULT_PREFERENCES,
      loopPlaybackEnabledDefault: false,
      activityFeedView: "compact",
      theme: "dark",
      primaryColor: "#123456",
    });
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(false);
    expect(store.getState().playbackControls.playbackSpeed).toBe(1);
    expect(store.getState()).not.toHaveProperty("theme");
    expect(store.getState().preferences.activityFeedView).toBe("compact");

    await persistor.flush();
    const migratedRoot = await readPersistedRoot(storage);
    expect(migratedRoot).not.toHaveProperty("theme");
    expect(JSON.parse(String(migratedRoot.preferences))).toMatchObject({
      theme: "dark",
      primaryColor: "#123456",
    });
  });

  it("migrates legacy named primary colors to their preset HEX values", async () => {
    const storage = createTestStorage({
      [`persist:${persistConfig.key}`]: JSON.stringify({
        preferences: JSON.stringify({
          ...DEFAULT_PREFERENCES,
          primaryColor: "blue",
          customPrimaryColor: "#abcdef",
        }),
        _persist: JSON.stringify({ version: 1, rehydrated: true }),
      }),
    });

    const { store } = await createPersistedTestStore(storage);

    expect(store.getState().preferences.primaryColor).toBe("#4299e1");
    expect(store.getState().preferences).not.toHaveProperty("customPrimaryColor");
  });

  it("preserves the legacy custom HEX representation and defaults invalid colors", async () => {
    const customStorage = createTestStorage({
      [`persist:${persistConfig.key}`]: JSON.stringify({
        preferences: JSON.stringify({
          ...DEFAULT_PREFERENCES,
          primaryColor: "custom",
          customPrimaryColor: "#abcdef",
        }),
        _persist: JSON.stringify({ version: 1, rehydrated: true }),
      }),
    });

    const invalidStorage = createTestStorage({
      [`persist:${persistConfig.key}`]: JSON.stringify({
        preferences: JSON.stringify({ ...DEFAULT_PREFERENCES, primaryColor: "invalid" }),
        _persist: JSON.stringify({ version: 1, rehydrated: true }),
      }),
    });

    const customStore = await createPersistedTestStore(customStorage);
    const invalidStore = await createPersistedTestStore(invalidStorage);

    expect(customStore.store.getState().preferences.primaryColor).toBe("#abcdef");
    expect(customStore.store.getState().preferences).not.toHaveProperty("customPrimaryColor");
    expect(invalidStore.store.getState().preferences.primaryColor).toBe(
      DEFAULT_PREFERENCES.primaryColor,
    );
  });

  it("does not rewrite active tools when a Preference changes", async () => {
    const { store } = await createPersistedTestStore();

    store.dispatch(preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }));

    expect(store.getState().preferences.loopPlaybackEnabledDefault).toBe(false);
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(true);
  });

  it("never persists active editor tools", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(playbackSpeedChanged(3));
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(persistedRoot).not.toHaveProperty("editorTools");
    expect(persistedRoot).not.toHaveProperty("playbackControls");
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      ...DEFAULT_PREFERENCES,
    });
  });

  it("never persists export runtime state or dialog state", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();
    store.dispatch(optimizedExportDialogOpened());
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(persistedRoot).not.toHaveProperty("export");
    expect(persistedRoot).not.toHaveProperty("exportPresets");
  });

  it("does not read the legacy Preferences storage key", async () => {
    const storage = createTestStorage({
      "easytrim.preferences.v1": JSON.stringify({
        loopPlaybackEnabledDefault: false,
      }),
    });

    const { store } = await createPersistedTestStore(storage);

    expect(store.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(store.getState()).not.toHaveProperty("theme");
  });

  it("falls back to the default for invalid and legacy activity feed view data", async () => {
    const storage = createTestStorage({
      [`persist:${persistConfig.key}`]: JSON.stringify({
        preferences: JSON.stringify({
          ...DEFAULT_PREFERENCES,
          activityFeedView: "expanded",
        }),
        activityView: JSON.stringify("compact"),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    });

    const { store } = await createPersistedTestStore(storage);

    expect(store.getState().preferences.activityFeedView).toBe("default");
  });

  it("persists a dispatched preference action without UI storage calls", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }));
    store.dispatch(preferenceChanged({ key: "stripMetadataOnExport", enabled: true }));
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      ...DEFAULT_PREFERENCES,
      loopPlaybackEnabledDefault: false,
      stripMetadataOnExport: true,
    });
  });

  it("resets only Editing settings while preserving Queue, Layout, and Appearance", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }));
    store.dispatch(preferenceChanged({ key: "segmentPlaybackEnabledDefault", enabled: false }));
    store.dispatch(preferenceChanged({ key: "mergeAudioEnabledDefault", enabled: true }));
    store.dispatch(preferenceChanged({ key: "stripMetadataOnExport", enabled: true }));
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(preferenceChanged({ key: "deleteSourceOnRenderFinish", enabled: true }));
    store.dispatch(queueFinishActionChanged("exit"));
    store.dispatch(activityFeedViewChanged("branch"));
    store.dispatch(layoutDensityChanged("compact"));
    store.dispatch(themePreferenceChanged("dark"));
    store.dispatch(primaryColorChanged("#4299e1"));
    store.dispatch(uiScaleIncreased());
    await persistor.flush();
    store.dispatch(editingSettingsReset());
    await persistor.flush();

    expect(store.getState().export.queueFinishAction).toBe("exit");
    expect(store.getState().preferences).toEqual({
      ...DEFAULT_PREFERENCES,
      activityFeedView: "branch",
      layoutDensity: "compact",
      theme: "dark",
      primaryColor: "#4299e1",
      autoStartQueueEnabled: false,
      deleteSourceOnRenderFinish: true,
      uiScalePercent: 125,
    });
    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      ...DEFAULT_PREFERENCES,
      activityFeedView: "branch",
      layoutDensity: "compact",
      theme: "dark",
      primaryColor: "#4299e1",
      autoStartQueueEnabled: false,
      deleteSourceOnRenderFinish: true,
      uiScalePercent: 125,
    });
  });

  it("resets only Queue settings while preserving Editing, Layout, and Appearance", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(queueFinishActionChanged("exit"));
    store.dispatch(preferenceChanged({ key: "autoStartQueueEnabled", enabled: false }));
    store.dispatch(preferenceChanged({ key: "deleteSourceOnRenderFinish", enabled: true }));
    store.dispatch(themePreferenceChanged("dark"));
    store.dispatch(primaryColorChanged("#123456"));
    store.dispatch(activityFeedViewChanged("branch"));
    store.dispatch(preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }));
    store.dispatch(preferenceChanged({ key: "segmentPlaybackEnabledDefault", enabled: false }));
    store.dispatch(preferenceChanged({ key: "mergeAudioEnabledDefault", enabled: true }));
    store.dispatch(preferenceChanged({ key: "stripMetadataOnExport", enabled: true }));
    store.dispatch(layoutDensityChanged("compact"));
    store.dispatch(uiScaleIncreased());
    store.dispatch(queueSettingsReset());
    await persistor.flush();

    expect(store.getState().export.queueFinishAction).toBe("nothing");
    expect(store.getState().preferences).toEqual({
      ...DEFAULT_PREFERENCES,
      activityFeedView: "branch",
      layoutDensity: "compact",
      theme: "dark",
      primaryColor: "#123456",
      loopPlaybackEnabledDefault: false,
      segmentPlaybackEnabledDefault: false,
      mergeAudioEnabledDefault: true,
      stripMetadataOnExport: true,
      uiScalePercent: 125,
    });
    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      ...DEFAULT_PREFERENCES,
      activityFeedView: "branch",
      layoutDensity: "compact",
      theme: "dark",
      primaryColor: "#123456",
      loopPlaybackEnabledDefault: false,
      segmentPlaybackEnabledDefault: false,
      mergeAudioEnabledDefault: true,
      stripMetadataOnExport: true,
      uiScalePercent: 125,
    });
  });

  it("persists theme actions inside Preferences without runtime or derived values", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(themePreferenceChanged("dark"));
    store.dispatch(primaryColorChanged("#4299e1"));
    store.dispatch(primaryColorChanged("#123456"));
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toMatchObject({
      theme: "dark",
      primaryColor: "#123456",
    });
    expect(persistedRoot).not.toHaveProperty("theme");
    expect(JSON.parse(String(persistedRoot.preferences))).not.toHaveProperty("resolvedTheme");
    expect(JSON.parse(String(persistedRoot.preferences))).not.toHaveProperty("primaryColorKey");
    expect(JSON.parse(String(persistedRoot.preferences))).not.toHaveProperty("systemPrefersDark");
  });

  it("persists activity feed view changes through preferences", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(activityFeedViewChanged("compact"));
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toMatchObject({
      activityFeedView: "compact",
    });
  });

  it("rehydrates the branch activity feed view through Preferences", async () => {
    const storage = createTestStorage({
      [`persist:${persistConfig.key}`]: JSON.stringify({
        preferences: JSON.stringify({ ...DEFAULT_PREFERENCES, activityFeedView: "branch" }),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    });

    const { store } = await createPersistedTestStore(storage);

    expect(store.getState().preferences.activityFeedView).toBe("branch");
  });

  it("keeps independently created stores and persistors isolated", async () => {
    const firstStorage = createTestStorage();
    const secondStorage = createTestStorage();
    const first = await createPersistedTestStore(firstStorage);
    const second = await createPersistedTestStore(secondStorage);

    first.store.dispatch(preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }));
    await first.persistor.flush();

    expect(second.store.getState().preferences).toEqual(DEFAULT_PREFERENCES);
    expect(secondStorage.values).toEqual(new Map());
  });
});
