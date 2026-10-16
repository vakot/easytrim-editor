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

  it("unlocks achievements earned before this session without announcing them", async () => {
    const nativeRecords = fakeNativeAchievements();
    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, optimizedExports: 150 });
    const store = renderTracker();

    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    expect(Object.keys(nativeRecords().unlockedAchievements).sort()).toEqual([
      "export-veteran",
      "first-export",
      "getting-started",
    ]);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("keeps the original unlock time of achievements unlocked in an earlier session", async () => {
    const nativeRecords = fakeNativeAchievements({
      ...emptyAchievementRecords,
      unlockedAchievements: { "first-export": 42 },
    });

    mocks.getUsageStatistics.mockResolvedValue({ ...emptyUsageStatistics, gifExports: 12 });
    const store = renderTracker();

    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    expect(nativeRecords().unlockedAchievements["first-export"]).toBe(42);
    expect(nativeRecords().unlockedAchievements["getting-started"]).toBeGreaterThan(42);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("announces an achievement unlocked by a new export", async () => {
    fakeNativeAchievements();
    const previous = { ...emptyUsageStatistics, optimizedExports: 1 };
    mocks.getUsageStatistics.mockResolvedValue(previous);
    const store = renderTracker();
    await waitFor(() => expect(store.getState().achievements.initialized).toBe(true));

    completeExport(store, { ...previous, gifExports: 1 });

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledTimes(1));
    expect(mocks.toast).toHaveBeenCalledWith(
      "GIF Maker",
      expect.objectContaining({
        description: "Achievement unlocked",
        id: "achievement-unlocked:gif-maker",
      }),
    );
  });

  it("announces simultaneous unlocks with one toast and never repeats them", async () => {
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
      expect.objectContaining({ description: "First Export, GIF Maker" }),
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
