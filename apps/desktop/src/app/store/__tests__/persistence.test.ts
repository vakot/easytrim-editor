import type { Persistor, Storage as PersistStorage } from "redux-persist";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_PREFERENCES } from "@/app/preferences";
import { persistConfig, resolveReduxPersistStorage } from "@/app/store/persistence";
import {
  createEditorToolsStateFromPreferences,
  editorToolsReset,
  playbackSpeedChanged,
} from "@/app/store/slices/editor-tools-slice";
import { optimizedExportDialogOpened, queueEntryAdded } from "@/app/store/slices/export-slice";
import {
  activityFeedViewChanged,
  customPrimaryColorChanged,
  preferenceChanged,
  preferencesReset,
  primaryColorChanged,
  themePreferenceChanged,
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
          customPrimaryColor: "#123456",
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
      customPrimaryColor: "#123456",
    });
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(false);
    expect(store.getState().editorTools.playbackSpeed).toBe(1);
    expect(store.getState()).not.toHaveProperty("theme");
    expect(store.getState().preferences.activityFeedView).toBe("compact");

    await persistor.flush();
    const migratedRoot = await readPersistedRoot(storage);
    expect(migratedRoot).not.toHaveProperty("theme");
    expect(JSON.parse(String(migratedRoot.preferences))).toMatchObject({
      theme: "dark",
      primaryColor: "#123456",
      customPrimaryColor: "#123456",
    });
  });

  it("does not rewrite active tools when a Preference changes", async () => {
    const { store } = await createPersistedTestStore();

    store.dispatch(preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }));

    expect(store.getState().preferences.loopPlaybackEnabledDefault).toBe(false);
    expect(store.getState().editorTools.loopPlaybackEnabled).toBe(true);
  });

  it("resets active tools from current Preferences defaults", async () => {
    const { store } = await createPersistedTestStore();

    store.dispatch(preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }));
    store.dispatch(playbackSpeedChanged(3));
    store.dispatch(
      editorToolsReset(createEditorToolsStateFromPreferences(store.getState().preferences)),
    );

    expect(store.getState().editorTools).toEqual({
      ...createEditorToolsStateFromPreferences({
        ...DEFAULT_PREFERENCES,
        loopPlaybackEnabledDefault: false,
      }),
    });
  });

  it("never persists active editor tools", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(playbackSpeedChanged(3));
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(persistedRoot).not.toHaveProperty("editorTools");
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      ...DEFAULT_PREFERENCES,
    });
  });

  it("never persists export runtime state, queue entries, or dialog state", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();
    store.dispatch(
      optimizedExportDialogOpened({
        resolution: { width: 1920, height: 1080 },
        frameRate: undefined,
      }),
    );
    store.dispatch(
      queueEntryAdded({
        addedAt: 1,
        id: "export-1",
        snapshot: {
          source: { displayName: "source.mp4", sourcePath: "C:/Media/source.mp4" },
          trim: { startMicros: 0, endMicros: 1_000_000 },
          crop: null,
          audio: { master: { enabled: true, volumePercent: 50 }, tracks: [], mergeAudio: false },
        },
        route: "fast",
        request: {
          sourcePath: "C:/Media/source.mp4",
          trim: { startMicros: 0, endMicros: 1_000_000 },
          audioTracks: [],
          mergeAudio: false,
        },
        outputId: "output-1",
        filename: "clip.mkv",
        path: "C:/Exports/clip.mkv",
        status: "queued",
        operationId: null,
        startedAt: null,
        durationMs: null,
        progressPercent: 0,
      }),
    );
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
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      ...DEFAULT_PREFERENCES,
      loopPlaybackEnabledDefault: false,
    });
  });

  it("persists reset state", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(preferenceChanged({ key: "loopPlaybackEnabledDefault", enabled: false }));
    await persistor.flush();
    store.dispatch(preferencesReset());
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      ...DEFAULT_PREFERENCES,
    });
  });

  it("persists theme actions inside Preferences without runtime or derived values", async () => {
    const { persistor, storage, store } = await createPersistedTestStore();

    store.dispatch(themePreferenceChanged("dark"));
    store.dispatch(primaryColorChanged("blue"));
    store.dispatch(customPrimaryColorChanged("#123456"));
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toMatchObject({
      theme: "dark",
      primaryColor: "#123456",
      customPrimaryColor: "#123456",
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
