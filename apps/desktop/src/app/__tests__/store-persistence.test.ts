import { combineReducers, configureStore, createSlice } from "@reduxjs/toolkit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TOOL_DEFAULTS } from "@/app/tool-settings";
import { createAppStore } from "@/app/store";
import { toolDefaultChanged, toolDefaultsReset } from "@/app/preferences-slice";
import { observePersistedDomains } from "@/app/store-persistence";
import { STORAGE_KEYS } from "@/lib/storage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Redux store persistence", () => {
  it("uses product defaults without creating persisted data", () => {
    const store = createAppStore();

    expect(store.getState().preferences.toolDefaults).toEqual(DEFAULT_TOOL_DEFAULTS);
    expect(localStorage.getItem(STORAGE_KEYS.preferences)).toBeNull();
  });

  it("hydrates Preferences from the compatible stored schema", () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify({ theme: "dark", toolDefaults: { loopPlaybackEnabled: false } }),
    );

    const store = createAppStore();

    expect(store.getState().preferences.toolDefaults).toEqual({
      ...DEFAULT_TOOL_DEFAULTS,
      loopPlaybackEnabled: false,
    });
  });

  it("persists a dispatched preference change without UI storage calls", () => {
    const store = createAppStore();

    store.dispatch(toolDefaultChanged({ key: "loopPlaybackEnabled", enabled: false }));

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) ?? "{}")).toEqual({
      toolDefaults: { ...DEFAULT_TOOL_DEFAULTS, loopPlaybackEnabled: false },
    });
  });

  it("persists a dispatched reset and preserves unrelated stored fields", () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify({ theme: "dark", toolDefaults: { loopPlaybackEnabled: false } }),
    );
    const store = createAppStore();

    store.dispatch(toolDefaultsReset());

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) ?? "{}")).toEqual({
      theme: "dark",
      toolDefaults: DEFAULT_TOOL_DEFAULTS,
    });
  });

  it("does not write Preferences for an unrelated action", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const store = createAppStore();
    setItem.mockClear();

    store.dispatch({ type: "runtime-only/action" });

    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not implicitly persist an unregistered runtime-only domain", () => {
    const runtimeSlice = createSlice({
      name: "runtime",
      initialState: { count: 0 },
      reducers: {
        increment: (state) => {
          state.count += 1;
        },
      },
    });
    const rootReducer = combineReducers({ runtime: runtimeSlice.reducer });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const store = configureStore({ reducer: rootReducer });

    observePersistedDomains(store, []);
    store.dispatch(runtimeSlice.actions.increment());

    expect(store.getState().runtime.count).toBe(1);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("keeps independently created stores isolated", () => {
    const first = createAppStore({
      preferences: { toolDefaults: { ...DEFAULT_TOOL_DEFAULTS, loopPlaybackEnabled: false } },
    });
    const second = createAppStore();

    expect(first.getState().preferences.toolDefaults.loopPlaybackEnabled).toBe(false);
    expect(second.getState().preferences.toolDefaults).toEqual(DEFAULT_TOOL_DEFAULTS);
  });
});
