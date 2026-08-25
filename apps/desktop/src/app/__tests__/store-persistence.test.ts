import { afterEach, describe, expect, it } from "vitest";
import type { Persistor, Storage as PersistStorage } from "redux-persist";

import { toolDefaultChanged, toolDefaultsReset } from "@/app/preferences-slice";
import { createAppPersistor, createAppStore, persistConfig, type AppStore } from "@/app/store";
import { DEFAULT_TOOL_DEFAULTS } from "@/app/tool-settings";

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
): Promise<{ store: AppStore; persistor: Persistor; storage: TestStorage }> {
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
  it("keeps Preferences defaults deterministic before rehydration", () => {
    const storage = createTestStorage();
    const store = createAppStore(storage);

    expect(store.getState().preferences.toolDefaults).toEqual(DEFAULT_TOOL_DEFAULTS);
    expect(storage.values).toEqual(new Map());
  });

  it("configures only Preferences for persistence", () => {
    expect(persistConfig.whitelist).toEqual(["preferences"]);
    expect(persistConfig.whitelist).not.toContain("editorTools");
    expect(persistConfig.whitelist).not.toContain("editorLayout");
  });

  it("rehydrates Preferences through redux-persist", async () => {
    const storage = createTestStorage({
      [`persist:${persistConfig.key}`]: JSON.stringify({
        preferences: JSON.stringify({
          toolDefaults: { ...DEFAULT_TOOL_DEFAULTS, loopPlaybackEnabled: false },
        }),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    });
    const { store } = await createPersistedTestStore(storage);

    expect(store.getState().preferences.toolDefaults).toEqual({
      ...DEFAULT_TOOL_DEFAULTS,
      loopPlaybackEnabled: false,
    });
  });

  it("does not read the legacy Preferences storage key", async () => {
    const storage = createTestStorage({
      "easytrim.preferences.v1": JSON.stringify({
        toolDefaults: { loopPlaybackEnabled: false },
      }),
    });
    const { store } = await createPersistedTestStore(storage);

    expect(store.getState().preferences.toolDefaults).toEqual(DEFAULT_TOOL_DEFAULTS);
  });

  it("persists a dispatched preference action without UI storage calls", async () => {
    const { store, persistor, storage } = await createPersistedTestStore();

    store.dispatch(toolDefaultChanged({ key: "loopPlaybackEnabled", enabled: false }));
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      toolDefaults: { ...DEFAULT_TOOL_DEFAULTS, loopPlaybackEnabled: false },
    });
  });

  it("persists reset state", async () => {
    const { store, persistor, storage } = await createPersistedTestStore();

    store.dispatch(toolDefaultChanged({ key: "loopPlaybackEnabled", enabled: false }));
    await persistor.flush();
    store.dispatch(toolDefaultsReset());
    await persistor.flush();

    const persistedRoot = await readPersistedRoot(storage);
    expect(JSON.parse(String(persistedRoot.preferences))).toEqual({
      toolDefaults: DEFAULT_TOOL_DEFAULTS,
    });
  });

  it("keeps independently created stores and persistors isolated", async () => {
    const firstStorage = createTestStorage();
    const secondStorage = createTestStorage();
    const first = await createPersistedTestStore(firstStorage);
    const second = await createPersistedTestStore(secondStorage);

    first.store.dispatch(toolDefaultChanged({ key: "loopPlaybackEnabled", enabled: false }));
    await first.persistor.flush();

    expect(second.store.getState().preferences.toolDefaults).toEqual(DEFAULT_TOOL_DEFAULTS);
    expect(secondStorage.values).toEqual(new Map());
  });
});
