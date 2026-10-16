import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import {
  getAchievementRecords,
  recordSplashMessageDiscovery,
  unlockAchievements,
} from "../achievements";

const nativeRecords = {
  discoveredSplashMessageIds: ["chosen-frame", "rainbow-mode"],
  unlockedAchievements: {
    "first-export": { unlockedAtMillis: 1_700_000_000_000 },
  },
};

const records = {
  discoveredSplashMessageIds: ["chosen-frame", "rainbow-mode"],
  unlockedAchievements: { "first-export": 1_700_000_000_000 },
};

describe("achievements IPC adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the records through the narrow command", async () => {
    mocks.invoke.mockResolvedValue(nativeRecords);

    await expect(getAchievementRecords()).resolves.toEqual(records);
    expect(mocks.invoke).toHaveBeenCalledWith("get_achievement_records");
  });

  it("unlocks achievements and reports only the newly unlocked ones", async () => {
    mocks.invoke.mockResolvedValue({
      records: nativeRecords,
      unlockedAchievementIds: ["first-export"],
    });

    await expect(unlockAchievements(["first-export", "gif-maker"])).resolves.toEqual({
      records,
      unlockedAchievementIds: ["first-export"],
    });
    expect(mocks.invoke).toHaveBeenCalledWith("unlock_achievements", {
      achievementIds: ["first-export", "gif-maker"],
    });
  });

  it("records a splash message discovery", async () => {
    mocks.invoke.mockResolvedValue(nativeRecords);

    await expect(recordSplashMessageDiscovery("rainbow-mode")).resolves.toEqual(records);
    expect(mocks.invoke).toHaveBeenCalledWith("record_splash_message_discovery", {
      messageId: "rainbow-mode",
    });
  });

  it.each([
    ["a missing response", null],
    ["missing discoveries", { unlockedAchievements: {} }],
    [
      "a non-numeric unlock time",
      { ...nativeRecords, unlockedAchievements: { "first-export": { unlockedAtMillis: "now" } } },
    ],
    ["an empty discovery identifier", { ...nativeRecords, discoveredSplashMessageIds: [""] }],
  ])("rejects %s", async (_label, value) => {
    mocks.invoke.mockResolvedValue(value);

    await expect(getAchievementRecords()).rejects.toMatchObject({ code: "internal" });
  });

  it("passes structured native errors through", async () => {
    mocks.invoke.mockRejectedValue({
      code: "invalid_request",
      messageId: "achievements.identifierIsInvalid",
    });

    await expect(unlockAchievements(["Not Valid"])).rejects.toMatchObject({
      code: "invalid_request",
      messageId: "achievements.identifierIsInvalid",
    });
  });
});
