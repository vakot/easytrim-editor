import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAchievementRecords: vi.fn(),
  recordSplashMessageDiscovery: vi.fn(),
  unlockAchievements: vi.fn(),
}));

vi.mock("@/lib/tauri/achievements", () => mocks);

import { selectAchievementRecords } from "@/app/store/slices/achievements-slice";
import { createAppStore } from "@/app/store/store";
import {
  discoverSplashMessage,
  loadAchievementRecords,
  unlockAchievements,
} from "@/app/store/thunks/achievement-thunks";

function createStore() {
  return createAppStore({
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  });
}

const empty = { discoveredSplashMessageIds: [], unlockedAchievements: {}, viewedAtMillis: null };

describe("achievement thunks", () => {
  beforeEach(() => vi.resetAllMocks());

  it("resolves with only the achievements the native store newly unlocked", async () => {
    const store = createStore();
    const records = { ...empty, unlockedAchievements: { "first-export": 1_000 } };
    mocks.unlockAchievements.mockResolvedValue({
      records,
      unlockedAchievementIds: ["first-export"],
    });

    await expect(
      store.dispatch(unlockAchievements(["first-export", "getting-started"])),
    ).resolves.toEqual(["first-export"]);
    expect(selectAchievementRecords(store.getState())).toEqual(records);
  });

  it("unlocks nothing when there is nothing to unlock and reports a native failure", async () => {
    const store = createStore();

    await expect(store.dispatch(unlockAchievements([]))).resolves.toEqual([]);
    expect(mocks.unlockAchievements).not.toHaveBeenCalled();

    mocks.unlockAchievements.mockRejectedValue({ code: "internal" });
    await expect(store.dispatch(unlockAchievements(["first-export"]))).resolves.toBeNull();
  });

  it("records a new splash message discovery but skips one already discovered", async () => {
    const store = createStore();
    mocks.getAchievementRecords.mockResolvedValue(empty);
    await store.dispatch(loadAchievementRecords());
    const discovered = { ...empty, discoveredSplashMessageIds: ["rainbow-mode"] };
    mocks.recordSplashMessageDiscovery.mockResolvedValue(discovered);

    await store.dispatch(discoverSplashMessage("rainbow-mode"));
    await store.dispatch(discoverSplashMessage("rainbow-mode"));

    expect(mocks.recordSplashMessageDiscovery).toHaveBeenCalledTimes(1);
    expect(selectAchievementRecords(store.getState())).toEqual(discovered);
  });
});
