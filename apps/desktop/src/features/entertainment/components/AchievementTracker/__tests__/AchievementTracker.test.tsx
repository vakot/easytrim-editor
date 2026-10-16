import { act, render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AchievementRecords } from "@/domain/achievement-records";
import type { UsageStatistics } from "@/domain/usage-statistics";

const mocks = vi.hoisted(() => ({
  getAchievementRecords: vi.fn(),
  getUsageStatistics: vi.fn(),
  recordSplashMessageDiscovery: vi.fn(),
  toast: vi.fn(),
  unlockAchievements: vi.fn(),
}));

vi.mock("@/lib/tauri/achievements", () => ({
  getAchievementRecords: mocks.getAchievementRecords,
  recordSplashMessageDiscovery: mocks.recordSplashMessageDiscovery,
  unlockAchievements: mocks.unlockAchievements,
}));
vi.mock("@/lib/tauri/statistics", () => ({ getUsageStatistics: mocks.getUsageStatistics }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { editingInstanceExportCompleted } from "@/app/store/slices/editing-instances-slice";
import { createAppStore } from "@/app/store/store";
import { i18n } from "@/i18n/config";
import { emptyAchievementRecords } from "@/test/achievement-records.fixtures";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

import { AchievementTracker } from "../AchievementTracker";

/** An in-memory stand-in for the native store: it unlocks each achievement only once. */
function fakeNativeAchievements(initial: AchievementRecords = emptyAchievementRecords) {
  let records = structuredClone(initial);
  let now = 10_000;
  mocks.getAchievementRecords.mockImplementation(async () => structuredClone(records));
  mocks.unlockAchievements.mockImplementation(async (ids: string[]) => {
    const unlockedAchievementIds = ids.filter((id) => !(id in records.unlockedAchievements));
    now += 1;
    for (const id of unlockedAchievementIds) records.unlockedAchievements[id] = now;
    records = structuredClone(records);
    return { records: structuredClone(records), unlockedAchievementIds };
  });
  return () => records;
}

function renderTracker() {
  const store = createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });

  render(
    <Provider store={store}>
      <AchievementTracker />
    </Provider>,
  );
  return store;
}

function completeExport(store: ReturnType<typeof renderTracker>, statistics: UsageStatistics) {
  mocks.getUsageStatistics.mockResolvedValue(statistics);
  act(() => {
    store.dispatch(
      editingInstanceExportCompleted({
        attemptId: crypto.randomUUID(),
        durationMs: 1_000,
        id: "instance-1",
        result: { displayName: "out.mp4", displayPath: "out.mp4", operationId: "operation" },
      }),
    );
  });
}

describe("AchievementTracker", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.resetAllMocks();
  });

  it("unlocks tiers earned before this session without announcing them", async () => {
    const nativeRecords = fakeNativeAchievements();
    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, optimizedExports: 150 });
    const store = renderTracker();

    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    expect(Object.keys(nativeRecords().unlockedAchievements).sort()).toEqual([
      "export-mastery-bronze",
      "export-mastery-gold",
      "export-mastery-silver",
    ]);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("gives every tier its own unlock time and keeps earlier unlock times", async () => {
    const nativeRecords = fakeNativeAchievements({
      ...emptyAchievementRecords,
      unlockedAchievements: { "export-mastery-bronze": 42 },
    });

    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, gifExports: 1 });
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    completeExport(store, { ...emptyUsageStatistics, gifExports: 10 });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));

    const unlocked = nativeRecords().unlockedAchievements;
    expect(unlocked["export-mastery-bronze"]).toBe(42);
    expect(unlocked["gif-creator-bronze"]).toBeGreaterThan(42);
    expect(unlocked["gif-creator-silver"]).toBeGreaterThan(unlocked["gif-creator-bronze"]!);
  });

  it("announces a newly unlocked tier with its series and tier", async () => {
    fakeNativeAchievements();
    const previous = { ...emptyUsageStatistics, gifExports: 4 };
    mocks.getUsageStatistics.mockResolvedValue(previous);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    completeExport(store, { ...previous, gifExports: 5 });

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(mocks.toast).toHaveBeenCalledWith(
      "GIF Creator",
      expect.objectContaining({
        description: "Silver tier unlocked",
        id: "achievement-unlocked:gif-creator-silver",
      }),
    );
  });

  it("announces several tiers of one series as its highest tier", async () => {
    fakeNativeAchievements();
    const previous = {
      ...emptyUsageStatistics,
      optimizedExports: 1,
      outputBytes: 1_024,
      sourceBytes: 1_024,
    };

    mocks.getUsageStatistics.mockResolvedValue(previous);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    // One large export can pass more than one threshold at once.
    completeExport(store, {
      ...previous,
      outputBytes: 12 * 1_024 ** 3,
      sourceBytes: 12 * 1_024 ** 3,
    });

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(mocks.toast).toHaveBeenCalledWith(
      "Data Cruncher",
      expect.objectContaining({ description: "Silver tier unlocked" }),
    );
  });

  it("announces unlocks across series with one summary toast and never repeats them", async () => {
    fakeNativeAchievements();
    mocks.getUsageStatistics.mockResolvedValue(emptyUsageStatistics);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    completeExport(store, { ...emptyUsageStatistics, gifExports: 1 });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    completeExport(store, { ...emptyUsageStatistics, gifExports: 1 });
    await waitFor(() => expect(mocks.getUsageStatistics).toHaveBeenCalledTimes(3));

    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(
      "2 achievements unlocked",
      expect.objectContaining({ description: "Export Mastery Bronze, GIF Creator Bronze" }),
    );
  });

  it("does not announce retroactive unlocks after a failed first attempt", async () => {
    fakeNativeAchievements();
    mocks.unlockAchievements.mockRejectedValueOnce({ code: "internal" });
    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, optimizedExports: 3 });
    const store = renderTracker();
    await waitFor(() => expect(mocks.unlockAchievements).toHaveBeenCalledTimes(1));
    expect(store.getState().achievements.initialized).toBe(false);

    completeExport(store, { ...emptyUsageStatistics, optimizedExports: 3 });

    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
